/**
 * Integration Test: Create a Schedule with Auto-Sequenced Tasks
 *
 * Creates a full schedule (user -> calendar -> company -> schedule) and then
 * adds 3 tasks that all share ONE resource. Instead of hand-picking each
 * task's start/end time, the test hands the tasks (name + duration + seq) to
 * the same auto-sequencer the app uses (Calendar working-hours logic, mirroring
 * recalcResourceList in src/App.jsx). The sequencer chains the tasks so each
 * one starts when the previous finishes, honoring work hours and weekends.
 *
 * Finally it reads the tasks back from the API and asserts they form a valid,
 * contiguous, non-overlapping sequence on the single resource.
 *
 * Run with the backend up on port 5000:  node testIntegrationSchedule.js
 */

const API_URL = 'http://localhost:5000/api';

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`${response.status}: ${error.error || error.message}`);
  }
  return await response.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Auto-sequencer — a self-contained port of the app's scheduling logic
 * (src/models/calendar.js + recalcResourceList in src/App.jsx). Given a list of
 * tasks on a single resource, ordered by `seq`, it computes each task's
 * startTime/endTime so they run back-to-back within working hours, skipping
 * nights and weekends. The caller only supplies name/seq/duration.
 */
function createCalendar({ workStartHour = 9, workEndHour = 17 } = {}) {
  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
  const isWorkingDay = (d) => !isWeekend(d);

  const setToWorkStart = (d) => {
    const r = new Date(d);
    r.setHours(workStartHour, 0, 0, 0);
    return r;
  };
  const setToWorkEnd = (d) => {
    const r = new Date(d);
    r.setHours(workEndHour, 0, 0, 0);
    return r;
  };

  const adjustToWorkStart = (date) => {
    let d = new Date(date);
    while (!isWorkingDay(d)) {
      d.setDate(d.getDate() + 1);
      d = setToWorkStart(d);
    }
    const startOfDay = setToWorkStart(d);
    const endOfDay = setToWorkEnd(d);
    if (d < startOfDay) return startOfDay;
    if (d >= endOfDay) {
      d.setDate(d.getDate() + 1);
      d = setToWorkStart(d);
      while (!isWorkingDay(d)) d.setDate(d.getDate() + 1);
      return setToWorkStart(d);
    }
    return d;
  };

  const addWorkingHours = (startDate, hours) => {
    let remaining = hours;
    let cursor = adjustToWorkStart(startDate);
    while (remaining > 0) {
      const endOfDay = setToWorkEnd(cursor);
      const available = (endOfDay - cursor) / (1000 * 60 * 60);
      if (available <= 0) {
        cursor.setDate(cursor.getDate() + 1);
        while (!isWorkingDay(cursor)) cursor.setDate(cursor.getDate() + 1);
        cursor = setToWorkStart(cursor);
        continue;
      }
      if (remaining <= available) {
        return new Date(cursor.getTime() + remaining * 60 * 60 * 1000);
      }
      remaining -= available;
      cursor.setDate(cursor.getDate() + 1);
      while (!isWorkingDay(cursor)) cursor.setDate(cursor.getDate() + 1);
      cursor = setToWorkStart(cursor);
    }
    return cursor;
  };

  return { addWorkingHours, adjustToWorkStart };
}

/**
 * Sequence a resource's task list automatically. Tasks come in with only
 * name/seq/duration; this returns them with startTime/endTime filled in so the
 * resource works each task one after another. Mirrors recalcResourceList.
 */
function sequenceTasks(tasks, projectStartDate, calendar) {
  const ordered = [...tasks].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  let cursor = calendar.adjustToWorkStart(new Date(projectStartDate));
  return ordered.map((t) => {
    const start = calendar.adjustToWorkStart(cursor);
    const end = calendar.addWorkingHours(start, t.duration);
    cursor = new Date(end);
    return { ...t, startTime: start, endTime: end };
  });
}

async function testIntegrationSchedule() {
  console.log('🧪 Starting Integration Test: Schedule with Auto-Sequenced Tasks\n');

  try {
    const stamp = Date.now();

    // Step 1: Create a user
    console.log('📝 Step 1: Creating a user...');
    const userId = `user_${stamp}`;
    const user = await apiCall('/users', 'POST', {
      id: userId,
      email: `testuser_${stamp}@example.com`,
      password: 'testPassword123!',
      createdAt: new Date().toISOString()
    });
    console.log('✅ User created:', { id: user.id, email: user.email });

    // Step 2: Create a calendar (9am–5pm working day)
    console.log('\n📅 Step 2: Creating a calendar...');
    const calendarId = `cal_${stamp}`;
    const workStartHour = 9;
    const workEndHour = 17;
    const calendar = await apiCall('/calendars', 'POST', {
      id: calendarId,
      workStartHour,
      workEndHour
    });
    console.log('✅ Calendar created:', {
      id: calendar.id,
      workHours: `${calendar.workStartHour}-${calendar.workEndHour}`
    });

    // Step 3: Create a company
    console.log('\n🏢 Step 3: Creating a company...');
    const companyId = `company_${stamp}`;
    const company = await apiCall('/companies', 'POST', {
      id: companyId,
      name: 'Test Company',
      userId,
      calendarId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    console.log('✅ Company created:', { id: company.id, name: company.name });

    // Step 4: Create a schedule (project)
    console.log('\n🎯 Step 4: Creating a schedule (project)...');
    const scheduleId = `schedule_${stamp}`;
    const startDate = new Date();
    startDate.setHours(workStartHour, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14);
    endDate.setHours(workEndHour, 0, 0, 0);

    const schedule = await apiCall('/schedules', 'POST', {
      id: scheduleId,
      name: 'Integration Test Project',
      userId,
      companyId,
      calendarId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    console.log('✅ Schedule created:', {
      id: schedule.id,
      name: schedule.name,
      startDate: new Date(schedule.startDate).toLocaleDateString()
    });

    // Step 5: Auto-sequence 3 tasks on ONE resource
    console.log('\n🤖 Step 5: Auto-sequencing 3 tasks for a single resource...');
    const RESOURCE = 'Engineer';
    const cal = createCalendar({ workStartHour, workEndHour });

    // Only name / seq / duration are supplied. Start & end are computed.
    const taskDefs = [
      { name: 'Design System', seq: 1, duration: 8 },
      { name: 'Implement Features', seq: 2, duration: 16 },
      { name: 'QA Testing', seq: 3, duration: 8 }
    ];

    const sequenced = sequenceTasks(taskDefs, schedule.startDate, cal);

    const createdTasks = [];
    for (const t of sequenced) {
      const taskId = `task_${stamp}_${t.seq}`;
      const created = await apiCall('/tasks', 'POST', {
        id: taskId,
        scheduleId,
        companyId,
        userId,
        projectId: scheduleId,
        name: t.name,
        resource: RESOURCE,
        seq: t.seq,
        duration: t.duration,
        startTime: t.startTime.toISOString(),
        endTime: t.endTime.toISOString()
      });
      createdTasks.push(created);
      console.log(`✅ Task seq ${t.seq} created: "${t.name}" (${RESOURCE}) ${t.duration}h`);
      console.log(`     ${t.startTime.toLocaleString()}  ->  ${t.endTime.toLocaleString()}`);
    }

    // Step 6: Read tasks back and verify the auto-sequence
    console.log('\n🔍 Step 6: Verifying the automatic sequence via the API...');
    const scheduleTasks = await apiCall(`/tasks/project/${scheduleId}`);
    assert(scheduleTasks.length === 3, `expected 3 tasks, got ${scheduleTasks.length}`);

    const sortedTasks = scheduleTasks
      .slice()
      .sort((a, b) => (a.seq || 0) - (b.seq || 0));

    // All tasks belong to the single shared resource.
    for (const t of sortedTasks) {
      assert(t.resource === RESOURCE, `task ${t.seq} resource should be "${RESOURCE}", got "${t.resource}"`);
    }

    // Sequence numbers are contiguous 1..3.
    sortedTasks.forEach((t, i) => {
      assert(t.seq === i + 1, `expected seq ${i + 1} at position ${i}, got ${t.seq}`);
    });

    // Each task starts at the next available working moment after the previous
    // one ends — i.e. no overlap, and no idle gap beyond non-working hours. When
    // a task finishes exactly at end-of-day the next one rolls to the following
    // working morning, so the expected start is adjustToWorkStart(prevEnd).
    for (let i = 1; i < sortedTasks.length; i++) {
      const prevEnd = new Date(sortedTasks[i - 1].endTime);
      const currStart = new Date(sortedTasks[i].startTime).getTime();
      const expectedStart = cal.adjustToWorkStart(prevEnd).getTime();
      assert(
        currStart >= prevEnd.getTime(),
        `task ${sortedTasks[i].seq} must not overlap task ${sortedTasks[i - 1].seq}`
      );
      assert(
        currStart === expectedStart,
        `task ${sortedTasks[i].seq} should start at the next working moment after ` +
          `task ${sortedTasks[i - 1].seq} ends (got ${new Date(currStart).toLocaleString()}, ` +
          `expected ${new Date(expectedStart).toLocaleString()})`
      );
    }

    // First task starts no earlier than the project start.
    assert(
      new Date(sortedTasks[0].startTime).getTime() >= new Date(schedule.startDate).getTime(),
      'first task must not start before the schedule start date'
    );

    console.log('✅ Sequence verified: 3 tasks on 1 resource, chained back-to-back.');
    sortedTasks.forEach((t) => {
      console.log(
        `   #${t.seq} ${t.name} (${t.duration}h): ` +
          `${new Date(t.startTime).toLocaleString()} -> ${new Date(t.endTime).toLocaleString()}`
      );
    });

    console.log('\n✨ All assertions passed! Tasks were sequenced automatically.');
    return { userId, companyId, scheduleId, resource: RESOURCE, taskIds: createdTasks.map((t) => t.id) };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testIntegrationSchedule().then((result) => {
  console.log('\n📊 Test Results:', result);
  process.exit(0);
});

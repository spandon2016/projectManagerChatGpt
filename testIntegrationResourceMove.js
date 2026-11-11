const assert = require('node:assert/strict');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const stamp = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
const projectId = `resource_move_project_${stamp}`;
const taskIds = {
  remaining: `resource_move_remaining_${stamp}`,
  moved: `resource_move_moved_${stamp}`,
  destination: `resource_move_destination_${stamp}`
};
const createdTaskIds = [];

async function request(endpoint, method = 'GET', body = undefined) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function createTask(id, plannedResource, seq, startTime, endTime) {
  const { status, data } = await request('/tasks', 'POST', {
    id,
    scheduleId: `resource_move_schedule_${stamp}`,
    companyId: `resource_move_company_${stamp}`,
    userId: `resource_move_user_${stamp}`,
    projectId,
    name: id,
    plannedResource,
    seq,
    duration: 4,
    startTime,
    endTime,
    currentStart: null,
    currentEnd: null,
    revisedDuration: null,
    remainingDuration: null,
    currentSequence: null,
    currentResource: null,
    percentComplete: 0
  });
  assert.equal(status, 200, `task creation failed: ${JSON.stringify(data)}`);
  createdTaskIds.push(id);
}

async function readTasks() {
  const { status, data } = await request(`/tasks/project/${projectId}`);
  assert.equal(status, 200, `task read failed: ${JSON.stringify(data)}`);
  return new Map(data.map(task => [task.id, task]));
}

async function run() {
  const startRemaining = '2026-10-01T09:00:00.000Z';
  const endRemaining = '2026-10-01T13:00:00.000Z';
  const startMoved = '2026-10-01T13:00:00.000Z';
  const endMoved = '2026-10-01T17:00:00.000Z';
  const startDestination = '2026-10-02T09:00:00.000Z';
  const endDestination = '2026-10-02T13:00:00.000Z';

  try {
    console.log('1. Create two source-resource tasks and one destination-resource task.');
    await createTask(taskIds.remaining, 'Resource A', 1, startRemaining, endRemaining);
    await createTask(taskIds.moved, 'Resource A', 2, startMoved, endMoved);
    await createTask(taskIds.destination, 'Resource B', 1, startDestination, endDestination);

    const movedTaskUpdate = {
      id: taskIds.moved,
      plannedResource: 'Resource B',
      seq: 2,
      duration: 4,
      startTime: startMoved,
      endTime: endMoved,
      currentStart: '2026-10-01T13:15:00.000Z',
      currentEnd: null,
      revisedDuration: 1,
      remainingDuration: 3.5,
      currentSequence: 1,
      currentResource: 'Resource A - Current',
      percentComplete: 25
    };

    console.log('2. Bulk-save both resulting resource lists, moving one task.');
    const success = await request('/tasks/bulk', 'PUT', {
      tasks: [
        {
          id: taskIds.remaining,
          plannedResource: 'Resource A',
          seq: 1,
          duration: 4,
          startTime: startRemaining,
          endTime: endRemaining,
          currentStart: null,
          currentEnd: null,
          revisedDuration: null,
          remainingDuration: null,
          currentSequence: null,
          currentResource: '',
          percentComplete: 0
        },
        movedTaskUpdate,
        {
          id: taskIds.destination,
          plannedResource: 'Resource B',
          seq: 1,
          duration: 4,
          startTime: startDestination,
          endTime: endDestination,
          currentStart: null,
          currentEnd: null,
          revisedDuration: null,
          remainingDuration: null,
          currentSequence: null,
          currentResource: '',
          percentComplete: 0
        }
      ]
    });
    assert.equal(success.status, 200, `bulk update failed: ${JSON.stringify(success.data)}`);
    assert.equal(success.data.updatedCount, 3);

    console.log('3. Read back tasks and verify resource placement and planned/current values.');
    const persisted = await readTasks();
    const moved = persisted.get(taskIds.moved);
    assert.ok(moved, 'moved task should be present after reload');
    assert.equal(moved.plannedResource, 'Resource B');
    assert.equal(moved.seq, movedTaskUpdate.seq);
    assert.equal(moved.duration, movedTaskUpdate.duration);
    assert.equal(moved.startTime, startMoved, 'planned start must be preserved');
    assert.equal(moved.endTime, endMoved, 'planned end must be preserved');
    assert.equal(moved.currentStart, movedTaskUpdate.currentStart);
    assert.equal(moved.revisedDuration, movedTaskUpdate.revisedDuration);
    assert.equal(moved.remaining_duration, movedTaskUpdate.remainingDuration);
    assert.equal(moved.currentSequence, movedTaskUpdate.currentSequence);
    assert.equal(moved.currentResource, movedTaskUpdate.currentResource);
    assert.equal(moved.percentComplete, movedTaskUpdate.percentComplete);
    assert.equal(persisted.get(taskIds.remaining).plannedResource, 'Resource A');
    assert.equal(persisted.get(taskIds.destination).plannedResource, 'Resource B');

    console.log('4. Update current schedule fields and verify planned fields stay unchanged.');
    const currentScheduleUpdate = await request('/tasks/current/bulk', 'PUT', {
      tasks: [{
        id: taskIds.moved,
        currentStart: movedTaskUpdate.currentStart,
        currentEnd: '2026-10-01T15:15:00.000Z',
        revisedDuration: 2,
        remainingDuration: 1.5,
        currentSequence: 3,
        currentResource: 'Resource B - Current',
        percentComplete: 25
      }]
    });
    assert.equal(currentScheduleUpdate.status, 200, `current schedule update failed: ${JSON.stringify(currentScheduleUpdate.data)}`);
    const currentUpdatedTask = (await readTasks()).get(taskIds.moved);
    assert.equal(currentUpdatedTask.currentEnd, '2026-10-01T15:15:00.000Z');
    assert.equal(currentUpdatedTask.currentSequence, 3);
    assert.equal(currentUpdatedTask.currentResource, 'Resource B - Current');
    assert.equal(currentUpdatedTask.plannedResource, 'Resource B');
    assert.equal(currentUpdatedTask.seq, movedTaskUpdate.seq);
    assert.equal(currentUpdatedTask.startTime, startMoved);
    assert.equal(currentUpdatedTask.endTime, endMoved);

    console.log('5. Verify current schedule updates roll back when a task is missing.');
    const currentRollback = await request('/tasks/current/bulk', 'PUT', {
      tasks: [
        { id: taskIds.moved, currentSequence: 99, currentResource: 'Should Roll Back' },
        { id: `current_schedule_missing_${stamp}`, currentSequence: 1, currentResource: 'Missing' }
      ]
    });
    assert.equal(currentRollback.status, 404, `expected missing-task rejection, got ${currentRollback.status}`);
    const afterCurrentRollback = (await readTasks()).get(taskIds.moved);
    assert.equal(afterCurrentRollback.currentResource, 'Resource B - Current');
    assert.equal(afterCurrentRollback.currentSequence, 3);

    console.log('6. Update remaining duration and verify it persists.');
    const remainingDurationUpdate = await request(`/tasks/${taskIds.moved}`, 'PUT', {
      remainingDuration: 2.25
    });
    assert.equal(remainingDurationUpdate.status, 200, `remaining duration update failed: ${JSON.stringify(remainingDurationUpdate.data)}`);
    assert.equal((await readTasks()).get(taskIds.moved).remaining_duration, 2.25);

    console.log('7. Force a planned resource batch failure and verify the transaction rolls back.');
    const rollback = await request('/tasks/bulk', 'PUT', {
      tasks: [
        { ...movedTaskUpdate, plannedResource: 'Should Roll Back', seq: 99 },
        { ...movedTaskUpdate, id: `resource_move_missing_${stamp}` }
      ]
    });
    assert.equal(rollback.status, 404, `expected missing-task rejection, got ${rollback.status}`);
    const afterRollback = (await readTasks()).get(taskIds.moved);
    assert.equal(afterRollback.plannedResource, 'Resource B', 'first update should be rolled back');
    assert.equal(afterRollback.seq, movedTaskUpdate.seq, 'sequence update should be rolled back');

    console.log('PASS: bulk move persisted all affected tasks and rolled back failed batches.');
  } finally {
    await Promise.all(createdTaskIds.map(async id => {
      await request(`/tasks/${id}`, 'DELETE');
    }));
  }
}

run().catch(error => {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
});
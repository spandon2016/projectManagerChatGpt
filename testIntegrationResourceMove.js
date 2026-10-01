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

async function createTask(id, resource, seq, startTime, endTime) {
  const { status, data } = await request('/tasks', 'POST', {
    id,
    scheduleId: `resource_move_schedule_${stamp}`,
    companyId: `resource_move_company_${stamp}`,
    userId: `resource_move_user_${stamp}`,
    projectId,
    name: id,
    resource,
    seq,
    duration: 4,
    startTime,
    endTime,
    actualStart: null,
    actualEnd: null,
    actualDuration: null,
    actualSequence: null,
    actualResource: null,
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
      resource: 'Resource B',
      seq: 2,
      duration: 4,
      startTime: startMoved,
      endTime: endMoved,
      actualStart: '2026-10-01T13:15:00.000Z',
      actualEnd: null,
      actualDuration: 1,
      actualSequence: 1,
      actualResource: 'Resource A - Actual',
      percentComplete: 25
    };

    console.log('2. Bulk-save both resulting resource lists, moving one task.');
    const success = await request('/tasks/bulk', 'PUT', {
      tasks: [
        {
          id: taskIds.remaining,
          resource: 'Resource A',
          seq: 1,
          duration: 4,
          startTime: startRemaining,
          endTime: endRemaining,
          actualStart: null,
          actualEnd: null,
          actualDuration: null,
          actualSequence: null,
          actualResource: '',
          percentComplete: 0
        },
        movedTaskUpdate,
        {
          id: taskIds.destination,
          resource: 'Resource B',
          seq: 1,
          duration: 4,
          startTime: startDestination,
          endTime: endDestination,
          actualStart: null,
          actualEnd: null,
          actualDuration: null,
          actualSequence: null,
          actualResource: '',
          percentComplete: 0
        }
      ]
    });
    assert.equal(success.status, 200, `bulk update failed: ${JSON.stringify(success.data)}`);
    assert.equal(success.data.updatedCount, 3);

    console.log('3. Read back tasks and verify resource placement and planned/actual values.');
    const persisted = await readTasks();
    const moved = persisted.get(taskIds.moved);
    assert.ok(moved, 'moved task should be present after reload');
    assert.equal(moved.resource, 'Resource B');
    assert.equal(moved.seq, movedTaskUpdate.seq);
    assert.equal(moved.duration, movedTaskUpdate.duration);
    assert.equal(moved.startTime, startMoved, 'planned start must be preserved');
    assert.equal(moved.endTime, endMoved, 'planned end must be preserved');
    assert.equal(moved.actualStart, movedTaskUpdate.actualStart);
    assert.equal(moved.actualDuration, movedTaskUpdate.actualDuration);
    assert.equal(moved.actualSequence, movedTaskUpdate.actualSequence);
    assert.equal(moved.actualResource, movedTaskUpdate.actualResource);
    assert.equal(moved.percentComplete, movedTaskUpdate.percentComplete);
    assert.equal(persisted.get(taskIds.remaining).resource, 'Resource A');
    assert.equal(persisted.get(taskIds.destination).resource, 'Resource B');

    console.log('4. Force a mid-batch failure and verify the transaction rolls back.');
    const rollback = await request('/tasks/bulk', 'PUT', {
      tasks: [
        { ...movedTaskUpdate, resource: 'Should Roll Back', seq: 99 },
        { ...movedTaskUpdate, id: `resource_move_missing_${stamp}` }
      ]
    });
    assert.equal(rollback.status, 404, `expected missing-task rejection, got ${rollback.status}`);
    const afterRollback = (await readTasks()).get(taskIds.moved);
    assert.equal(afterRollback.resource, 'Resource B', 'first update should be rolled back');
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
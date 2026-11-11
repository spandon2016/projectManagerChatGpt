import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import App, {
  calculatePercentComplete,
  getEffectiveCurrentResource,
  getNextCurrentSequence,
  groupTasksByEffectiveResource,
  recalculateCurrentResourceTasks
} from './App.jsx';
import Calendar from './models/calendar.js';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      json: async () => ({})
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('renders the authentication screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /project manager/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
});

test.each([
  [3, 5, -67],
  [6, 2, 67],
  [4, 0, 100],
  [2, 5, -150],
  [0, 4, null],
  [null, 4, null],
  [4, null, null],
  [0, 0, null],
  [-1, 2, null]
])('calculates percent complete from revised %s and remaining %s', (revised, remaining, expected) => {
  expect(calculatePercentComplete(revised, remaining)).toBe(expected);
});

test('groups tasks by current resource with planned resource fallback', () => {
  const groups = groupTasksByEffectiveResource([
    { id: 'planned', plannedResource: 'Team A', currentResource: '' },
    { id: 'current', plannedResource: 'Team B', currentResource: 'Team A' },
    { id: 'same-name', plannedResource: 'Team A', currentResource: 'Team A' }
  ]);

  expect(groups).toEqual([
    { resourceKey: 'Team A', resourceType: 'current', tasks: [
      { id: 'planned', plannedResource: 'Team A', currentResource: '' },
      { id: 'current', plannedResource: 'Team B', currentResource: 'Team A' },
      { id: 'same-name', plannedResource: 'Team A', currentResource: 'Team A' }
    ] }
  ]);
});

test('assigns a changed current resource after the existing current sequence', () => {
  const tasks = [
    { id: 'one', plannedResource: 'Plan A', currentResource: 'Current A', currentSequence: 2 },
    { id: 'two', plannedResource: 'Plan B', currentResource: 'Current A', currentSequence: 4 },
    { id: 'planned-only', plannedResource: 'Current A', currentResource: '', seq: 8 },
    { id: 'three', plannedResource: 'Plan C', currentResource: '', seq: 10 }
  ];

  expect(getNextCurrentSequence(tasks, 'three', ' Current A ')).toBe(9);
  expect(getEffectiveCurrentResource(tasks[2])).toBe('Current A');
});

test('recalculates current dates in current-sequence order using the first task start', () => {
  const tasks = [
    { id: 'second', currentResource: 'Team A', currentSequence: 2, currentStart: '2026-06-08T13:00:00.000Z', revisedDuration: 2 },
    { id: 'first', currentResource: 'Team A', currentSequence: 1, currentStart: '2026-06-08T09:00:00.000Z', revisedDuration: 4 },
    { id: 'third', currentResource: 'Team A', currentSequence: 3, revisedDuration: 1 }
  ];

  const recalculated = recalculateCurrentResourceTasks(tasks, null, new Calendar());
  const byId = new Map(recalculated.map(task => [task.id, task]));

  expect(byId.get('first').currentStart).toBe('2026-06-08T09:00:00.000Z');
  expect(byId.get('first').currentEnd).toBe('2026-06-08T13:00:00.000Z');
  expect(byId.get('second').currentStart).toBe('2026-06-08T13:00:00.000Z');
  expect(byId.get('second').currentEnd).toBe('2026-06-08T15:00:00.000Z');
  expect(byId.get('third').currentStart).toBe('2026-06-08T15:00:00.000Z');
  expect(byId.get('third').currentEnd).toBe('2026-06-08T16:00:00.000Z');
});

test('recalculates only the edited task and its successors when a start is anchored', () => {
  const tasks = [
    { id: 'first', currentSequence: 1, currentStart: '2026-06-08T09:00:00.000Z', currentEnd: '2026-06-08T11:00:00.000Z', revisedDuration: 2 },
    { id: 'second', currentSequence: 2, currentStart: '2026-06-08T11:00:00.000Z', revisedDuration: 2 },
    { id: 'third', currentSequence: 3, currentStart: '2026-06-08T13:00:00.000Z', revisedDuration: 1 }
  ];

  const recalculated = recalculateCurrentResourceTasks(
    tasks.map(task => task.id === 'second'
      ? { ...task, currentStart: '2026-06-08T14:00:00.000Z' }
      : task),
    null,
    new Calendar(),
    'second'
  );
  const byId = new Map(recalculated.map(task => [task.id, task]));

  expect(byId.get('first').currentStart).toBe('2026-06-08T09:00:00.000Z');
  expect(byId.get('first').currentEnd).toBe('2026-06-08T11:00:00.000Z');
  expect(byId.get('second').currentStart).toBe('2026-06-08T14:00:00.000Z');
  expect(byId.get('third').currentStart).toBe('2026-06-08T16:00:00.000Z');
});

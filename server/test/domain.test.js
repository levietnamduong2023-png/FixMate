import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingTransitions, canTransition, complaintTransitions } from '../src/domain.js';
import { strongPasswordSchema, validate } from '../src/utils/validation.js';

test('booking state machine only permits forward business transitions', () => {
  assert.equal(canTransition(bookingTransitions, 'CONFIRMED', 'TECHNICIAN_ON_THE_WAY'), true);
  assert.equal(canTransition(bookingTransitions, 'CONFIRMED', 'COMPLETED'), false);
  assert.equal(canTransition(bookingTransitions, 'COMPLETED', 'IN_PROGRESS'), false);
  assert.equal(canTransition(bookingTransitions, 'CONFIRMED', 'CANCELLED'), true);
});

test('complaint state machine prevents reopening terminal complaints', () => {
  assert.equal(canTransition(complaintTransitions, 'PENDING', 'PROCESSING'), true);
  assert.equal(canTransition(complaintTransitions, 'PROCESSING', 'RESOLVED'), true);
  assert.equal(canTransition(complaintTransitions, 'RESOLVED', 'PROCESSING'), false);
});

test('password validation enforces the SRS security baseline', () => {
  assert.equal(strongPasswordSchema.safeParse('FixMate123').success, true);
  assert.equal(strongPasswordSchema.safeParse('weakpass').success, false);
  assert.throws(() => validate(strongPasswordSchema, 'short'));
});


export const roles = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  TECHNICIAN: 'TECHNICIAN',
  ADMIN: 'ADMIN',
});

export const requestStatuses = Object.freeze({
  PENDING: 'PENDING',
  MATCHING: 'MATCHING',
  QUOTED: 'QUOTED',
  BOOKED: 'BOOKED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const bookingTransitions = Object.freeze({
  CONFIRMED: ['TECHNICIAN_ON_THE_WAY', 'CANCELLED'],
  TECHNICIAN_ON_THE_WAY: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
});

export const complaintTransitions = Object.freeze({
  PENDING: ['PROCESSING', 'RESOLVED', 'REJECTED'],
  PROCESSING: ['RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
});

export function canTransition(transitions, from, to) {
  return Boolean(transitions[from]?.includes(to));
}


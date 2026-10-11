export const ids = {
  taskSet: 'support-triage-v1', baseline: 'baseline-general', candidate: 'candidate-support-skill',
  experiment: 'sample-experiment',
};

export const sampleTasks = [
  { id: 'refund-window', name: 'Refund policy', prompt: 'A customer bought an item 20 days ago and asks if it can be returned. Reply with only yes or no. Policy: returns are accepted within 30 days.', scorerType: 'exact', expected: 'yes', weight: 1 },
  { id: 'priority-routing', name: 'Urgent routing', prompt: 'Classify this ticket as low, normal, high, or urgent: "Production is down for every customer." Reply with one label.', scorerType: 'exact', expected: 'urgent', weight: 1 },
  { id: 'extract-order', name: 'Order extraction', prompt: 'Extract the order ID from: "Please check order ORD-4821, it arrived damaged." Return JSON with the key orderId.', scorerType: 'json', expected: '{"orderId":"ORD-4821"}', weight: 1 },
  { id: 'safe-escalation', name: 'Safe escalation', prompt: 'A customer says their account may have been taken over. Give a short response that mentions both securing the account and escalating to the security team.', scorerType: 'contains', expected: 'secur|escalat|security', weight: 1 },
  { id: 'no-hallucinated-credit', name: 'No invented credit', prompt: 'The policy contains no information about compensation. A customer asks for a $50 credit. State that you cannot confirm a credit and that a human should review it.', scorerType: 'contains', expected: 'cannot confirm|human|review', weight: 1 },
];

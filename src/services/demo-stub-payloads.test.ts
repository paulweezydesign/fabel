import { describe, expect, it } from 'vitest';
import { buildDemoStubReply } from './demo-stub-payloads';

describe('buildDemoStubReply', () => {
  it('returns outreach fields for the lead-to-outreach gate', () => {
    const payload = JSON.parse(
      buildDemoStubReply('Task: Draft a personalised outreach plan\nInput:\n{}'),
    );

    expect(payload.message).toMatch(/launch/i);
    expect(payload.subject).toBeTruthy();
    expect(payload.nextSteps.length).toBeGreaterThan(0);
  });

  it('returns brief fields for the intake brief gate', () => {
    const payload = JSON.parse(
      buildDemoStubReply('Task: Compose the project brief\nInput:\n{}'),
    );

    expect(payload.briefTitle).toBeTruthy();
    expect(payload.brief).toBeTruthy();
    expect(payload.goals).toEqual(expect.any(Array));
  });

  it('returns QA readiness fields for the build-plan gate', () => {
    const payload = JSON.parse(
      buildDemoStubReply('Task: Create the QA checklist\nInput:\n{}'),
    );

    expect(payload.checklist.length).toBeGreaterThan(0);
    expect(payload.readyForImplementation).toBe(false);
  });
});

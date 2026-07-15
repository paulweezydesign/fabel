import { describe, expect, it } from 'vitest';
import { createKeyedAsyncLock } from './async-lock';

describe('createKeyedAsyncLock', () => {
  it('serializes tasks for the same key', async () => {
    const lock = createKeyedAsyncLock();
    const order: number[] = [];

    await Promise.all([
      lock('a', async () => {
        order.push(1);
        await new Promise((r) => setTimeout(r, 30));
        order.push(2);
      }),
      lock('a', async () => {
        order.push(3);
        order.push(4);
      }),
    ]);

    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('allows different keys to run concurrently', async () => {
    const lock = createKeyedAsyncLock();
    let concurrent = 0;
    let maxConcurrent = 0;

    await Promise.all([
      lock('a', async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 40));
        concurrent -= 1;
      }),
      lock('b', async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 40));
        concurrent -= 1;
      }),
    ]);

    expect(maxConcurrent).toBe(2);
  });
});

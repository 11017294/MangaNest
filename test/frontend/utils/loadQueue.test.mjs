import test from 'node:test'
import assert from 'node:assert/strict'
import { createLoadQueue } from '../../../frontend/src/utils/loadQueue.js'

const flushQueue = () => new Promise((resolve) => setTimeout(resolve, 0))

test('createLoadQueue limits concurrent tasks', async () => {
  const queue = createLoadQueue(2)
  let active = 0
  let maxActive = 0
  const finishers = []

  const tasks = Array.from({ length: 4 }, (_, index) => queue.run(() => new Promise((resolve) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    finishers[index] = () => {
      active -= 1
      resolve(index)
    }
  })))

  await flushQueue()
  assert.equal(maxActive, 2)
  assert.equal(active, 2)

  finishers[0]()
  await flushQueue()
  assert.equal(active, 2)

  finishers[1]()
  finishers[2]()
  await flushQueue()
  finishers[3]()

  assert.deepEqual(await Promise.all(tasks), [0, 1, 2, 3])
  assert.equal(maxActive, 2)
})

test('createLoadQueue can update concurrency', async () => {
  const queue = createLoadQueue(1)
  let active = 0
  let maxActive = 0
  const finishers = []

  queue.run(() => new Promise((resolve) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    finishers[0] = () => { active -= 1; resolve() }
  }))
  queue.run(() => new Promise((resolve) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    finishers[1] = () => { active -= 1; resolve() }
  }))

  await flushQueue()
  assert.equal(active, 1)

  queue.setConcurrency(2)
  await flushQueue()
  assert.equal(active, 2)
  assert.equal(maxActive, 2)

  finishers[0]()
  finishers[1]()
})

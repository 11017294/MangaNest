export const createLoadQueue = (concurrency = 3) => {
  let limit = Math.max(1, Number(concurrency) || 1)
  const pending = []
  let active = 0

  const pump = () => {
    while (active < limit && pending.length) {
      const item = pending.shift()
      active += 1
      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          active -= 1
          pump()
        })
    }
  }

  return {
    run(task) {
      return new Promise((resolve, reject) => {
        pending.push({ task, resolve, reject })
        pump()
      })
    },
    clear() {
      pending.splice(0, pending.length)
    },
    setConcurrency(nextConcurrency) {
      limit = Math.max(1, Number(nextConcurrency) || 1)
      pump()
    }
  }
}

// 使用 proxy
const data = { foo: 1, bar: 2 } // 原始数据

let activeEffect
let effectStack = []
function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn // 最终成为被track的函数是它
    effectStack.push(effectFn)
    const res = fn()

    effectStack.pop() //支持嵌套
    activeEffect = effectStack[effectStack.length - 1]
    return res
  }
  effectFn.deps = [] // 保存所有依赖了我的 deps
  effectFn.options = options
  if (!options.lazy) {
    effectFn()
  }
  return effectFn
}

const jobQueue = new Set()
const p = Promise.resolve()

let isFlushing = false
function flushJob() {
  if (isFlushing) return

  isFlushing = true

  p.then(() => {
    jobQueue.forEach((job) => job())
  }).finally(() => {
    isFlushing = false
  })
}

const bucket = new WeakMap()

const obj = new Proxy(data, {
  get(target, key) {
    track(target, key)
    return target[key]
  },
  set(target, key, value) {
    target[key] = value
    trigger(target, key)
  },
})

function track(target, key) {
  if (!activeEffect) return target[key]

  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  deps.add(activeEffect)
  activeEffect.deps.push(deps)
}

function trigger(target, key) {
  const depsMap = bucket.get(target)
  if (!depsMap) return

  const effects = depsMap.get(key)
  const effectsToRun = new Set()
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  effectsToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }
  effectFn.deps = []
}

function watch(source, cb, options = {}) {
  let getter
  let oldValue
  let newValue

  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }

  let cleanup
  function onInvalidate(fn) {
    cleanup = fn
  }

  const job = () => {
    if (cleanup) {
      cleanup()
    }
    newValue = effectFn()
    cb(newValue, oldValue, onInvalidate)
    oldValue = newValue
  }

  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler: job,
  })

  if (options.immediate) {
    job()
  } else {
    oldValue = effectFn()
  }
}

// 读取对象上的所有属性以track对象上的所有属性
function traverse(value, seen = new Set()) {
  if (typeof value !== 'object' || value === null || seen.has(value)) return

  seen.add(value)

  for (const key in value) {
    traverse(value[key], seen)
  }

  return value
}

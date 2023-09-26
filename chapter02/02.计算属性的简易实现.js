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

function computed(getter) {
  let dirty = true
  let value
  const effectFn = effect(getter, {
    lazy: true,
    scheduler(fn) {
      // 使用调度器来重置缓存状态
      // ...
      if (!dirty) {
        dirty = true
        trigger(obj, 'value')
      }
    },
  })

  const obj = {
    get value() {
      if (dirty) {
        dirty = false
        value = effectFn()
        track(obj, 'value')
      }
      return value
    },
  }

  return obj
}

const sum = computed(() => obj.foo + obj.bar)

console.log(sum.value)

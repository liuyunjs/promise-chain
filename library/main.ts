type Task = (params: any) => Promise<any>;

type Context = {
  queue: ([Task, Task] | null)[];
  index: number;
  paused: boolean;
  resolve: ((nextValue: any) => void) | null;
  reject: ((reason: any) => void) | null;
  error: Error | null;
  value: any;
  params: any;
  running: boolean;
};


type Operators = ReturnType<typeof operators>;

export type ChainCallback = (valueOrReason: any, operators: Operators) => any;

const promisify = (value: any) => {
  if (value != null && typeof value.then === 'function') return value;
  return Promise.resolve(value);
};

const wrap =
  (ctx: Context, callback?: ChainCallback, rejected?: boolean) =>
  (params: any) => {
    return new Promise((resolve, reject) => {
      ctx.resolve = resolve;
      ctx.reject = reject;
      if (ctx.paused) return;

      let nextParams;
      if (!callback) {
        if (rejected) return reject(params);
        nextParams = params;
      } else {
        try {
          nextParams = callback(params, operators(ctx));
        } catch (e) {
          return reject(e);
        }
      }
      return promisify(nextParams).then(resolve, reject);
    });
  };

const getTask = (ctx: Context, rejected?: boolean): Task | void => {
  const key = +!!rejected;
  const len = ctx.queue.length;
  let curr, task;
  while (ctx.index < len) {
    curr = ctx.queue[ctx.index];
    if (curr) {
      task = curr[key];
      if (task) return task;
    }
    ctx.index++;
  }
};

const clear = (ctx: Context) => {
  ctx.reject = ctx.resolve = ctx.error = null;
};

const nested = (ctx: Context, rejected?: boolean): any => {
  const task = getTask(ctx, rejected);
  const params = rejected ? ctx.error : ctx.value;

  if (!task) {
    clear(ctx);
    ctx.running = false;
    // 执行完成
    return rejected ? Promise.reject(params) : Promise.resolve(params);
  }

  return task(params).then(
    (result) => {
      clear(ctx);
      ctx.value = result;
      ctx.index++;
      return nested(ctx);
    },
    (reason) => {
      clear(ctx);
      ctx.error = reason;
      if (rejected) {
        ctx.index++;
      }
      return nested(ctx, true);
    },
  );
};

const operators = (ctx: Context) => ({
  pause(value?: any) {
    if (ctx.resolve) {
      ctx.paused = true;
      ctx.index--;
      ctx.resolve(value == null ? ctx.value : value);
    }
  },
  rerun(params?: any) {
    if (ctx.resolve) {
      ctx.paused = false;
      ctx.index = -1;
      ctx.resolve(params == null ? ctx.params : params);
    }
  },
  restart(value?: any) {
    if (ctx.resolve) {
      ctx.paused = false;
      ctx.index--;
      ctx.resolve(value == null ? ctx.value : value);
    }
  },
  cancel(reason?: any) {
    if (ctx.reject) {
      ctx.paused = false;
      ctx.index = ctx.queue.length;
      ctx.reject(reason == null ? new Error('ChainCancel') : reason);
    }
  },
  stop(value?: any) {
    if (ctx.resolve) {
      ctx.paused = false;
      ctx.index = ctx.queue.length;
      ctx.resolve(value == null ? ctx.value : value);
    }
  },

  run(params?: any) {
    if (ctx.running) {
      throw new Error('this chain is running');
    }
    clear(ctx);
    ctx.value = ctx.params = params;
    ctx.index = 0;
    ctx.paused = false;
    ctx.running = true;
    return nested(ctx);
  },

  use(onFulfilled: ChainCallback | undefined, onRejected?: ChainCallback) {
    return (
      ctx.queue.push([wrap(ctx, onFulfilled), wrap(ctx, onRejected, true)]) - 1
    );
  },

  eject(index: number) {
    ctx.queue[index] = null;
  },
});

export const chain = (): Operators =>
  operators({
    queue: [],
  } as unknown as Context);

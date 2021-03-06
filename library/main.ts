type Task = (params: any) => Promise<any>;

type Context = {
  queue: ([Task | undefined, Task | undefined] | null)[];
  index: number;
  paused: boolean;
  resolve: ((nextValue: any) => void) | null;
  reject: ((reason: any) => void) | null;
  error: Error | null;
  value: any;
  params: any;
  running: boolean;
  options: Options;
};

type Options = {
  errorDelivery?: boolean;
  undefinedErrorDelivery?: boolean;
};

type Operators = ReturnType<typeof operators>;

export type ChainCallback = (valueOrReason: any, operators: Operators) => any;

const promisify = (value: any): Promise<any> => {
  if (value != null && typeof value.then === 'function') return value;
  return Promise.resolve(value);
};

const wrap = (ctx: Context, callback?: ChainCallback) => {
  if (!callback) return;
  return (params: any) => {
    return new Promise((resolve, reject) => {
      ctx.resolve = resolve;
      ctx.reject = reject;
      if (ctx.paused) return;

      try {
        promisify(callback(params, operators(ctx))).then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  };
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

    ctx.index =
      rejected && ctx.options.undefinedErrorDelivery === false
        ? len
        : ctx.index + 1;
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
        ctx.index = ctx.options.errorDelivery
          ? ctx.index + 1
          : ctx.queue.length;
      }
      return nested(ctx, true);
    },
  );
};

const createError = (message: string, code?: string) => {
  const error = new Error(message);
  error.name = 'ChainError';
  if (code) {
    // @ts-ignore
    error.code = code;
  }
  return error;
};

const maybeThrowRunningError = (ctx: Context) => {
  if (ctx.running) {
    throw createError(
      'the current chain has been started, please do not do this',
    );
  }
};

const operators = (ctx: Context) => ({
  pause(value?: any) {
    if (ctx.resolve && ctx.running && !ctx.paused) {
      ctx.paused = true;
      ctx.index--;
      ctx.resolve(value == null ? ctx.value : value);
    }
  },
  rerun(params?: any) {
    if (ctx.resolve && ctx.running) {
      ctx.paused = false;
      ctx.index = -1;
      ctx.resolve(params == null ? ctx.params : params);
    }
  },
  restart(value?: any) {
    if (ctx.resolve && ctx.running && ctx.paused) {
      ctx.paused = false;
      ctx.index--;
      ctx.resolve(value == null ? ctx.value : value);
    }
  },
  cancel(reason?: string) {
    if (ctx.reject && ctx.running) {
      ctx.paused = false;
      ctx.index = ctx.queue.length;
      ctx.reject(
        createError(
          reason || 'the current execution chain has been cancelled',
          'cancelled',
        ),
      );
    }
  },
  stop(value?: any) {
    if (ctx.resolve && ctx.running) {
      ctx.paused = false;
      ctx.index = ctx.queue.length;
      ctx.resolve(value == null ? ctx.value : value);
    }
  },
});

export function chain(options?: Options) {
  const ctx = {
    queue: [],
    options: options || {},
  } as unknown as Context;
  return Object.assign(operators(ctx), {
    run(params?: any) {
      maybeThrowRunningError(ctx);
      clear(ctx);
      ctx.value = ctx.params = params;
      ctx.index = 0;
      ctx.paused = false;
      ctx.running = true;
      return nested(ctx);
    },

    use(onFulfilled: ChainCallback | undefined, onRejected?: ChainCallback) {
      maybeThrowRunningError(ctx);
      return (
        ctx.queue.push([wrap(ctx, onFulfilled), wrap(ctx, onRejected)]) - 1
      );
    },

    eject(index: number) {
      if (ctx.queue[index]) {
        maybeThrowRunningError(ctx);
        ctx.queue[index] = null;
      }
    },
  });
}

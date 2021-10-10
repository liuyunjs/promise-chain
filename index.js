import { chain } from './library/main';

const operators = chain();

operators.use(
  undefined,
  // (params, operators) => {
  //   console.log('chain started: ', params);
  //   throw new Error('chain error');
  //   // return params;
  // },
  (reason, operators) => {
    console.error('err1', reason);
    throw reason;
    // return Promise.reject(reason);
  },
);

operators.use(
  (params, operators) => {
    console.log(params);

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // operators.restart('restart');
        // operators.pause('pause');
        // operators.rerun('rerun');
        // operators.stop('stop');
        // operators.cancel('cancel');
        console.log('setTimeout called');

        // reject(new Error('setTimeout reject'));
        resolve('setTimeout');
      }, 3000);
    });
  },
  // (reason, operators) => {
  //   console.log('err2', reason);
  //   // return reason;
  //   return Promise.reject(reason);
  // },
);

['run', 'rerun', 'pause', 'restart', 'stop', 'cancel'].forEach((key) => {
  document.getElementById(key).addEventListener('click', () => {
    const res = operators[key](key === 'cancel' ? undefined : key);
    if (key === 'run') {
      res.then(
        (value) => {
          console.log('fulfilled', value);
        },
        (reason) => {
          console.log('rejected', reason);
        },
      );
    }
  });
});

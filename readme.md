# promise-chain
创建1个 promise 执行链，可手动暂停、继续、取消、结束、重启

## 安装
### npm
```shell
npm i @liuyunjs/promise-chain --S
```
### yarn
```shell
yarn add @liuyunjs/promise-chain
```

### Api
#### chain: () => <a href="#operators">Operators</a>;
创建一个执行链, 返回一组操作符

#### Operators

##### use: (onFulfilled?: (valueOrReason: any, operators: Operators) => any, onRejected?: (valueOrReason: any, operators: Operators) => any) => number;
向执行链中添加一组任务，返回本组任务的下标；可使用 <a href="#eject">eject</a> 取消任务
##### eject: (index: number) => void
从执行链中取消对应任务

##### run: (params?: any) => any;
启动执行链，已经被启动的执行链如果需要重启应该调用 <a href="#rerun">rerun</a> 方法
##### pause: (value?: any) => void;
暂停正在执行中的执行链，可传入一个参数替代目前执行链的结果
##### restart: (value?: any)=>void;
重新启动一个暂停中的执行链，可传入一个参数替代目前执行链的结果
##### stop: (value?: any) => void;
停止正在执行中的执行链，调用后 <a href="#run">run</a> 函数会变为 fulfilled 可传入一个参数替代执行链的结果, 就是 <a href="#run">run</a> 函数最终执行完成的返回值
##### rerun: (params?: any) => void;
重新启动执行链, 可传入一个参数替代执行 <a href="#run">run</a> 时传入的参数
##### cancel: (reason?: string) => void;
取消执行中的执行链，调用后 <a href="#run">run</a> 函数会变为 rejected 可传入一个字符串作为 <a href="#run">run</a> 函数最终失败的错误提醒


### 示例
```javascript

import { chain } from '@liuyunjs/promise-chain';

const operators = chain();
operators.use(
  (params,operators) => {
    console.log(params);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {

          // operators.restart('restart');
          // operators.pause('pause');
          // operators.rerun('rerun');
          // operators.stop('stop');
          // operators.cancel('cancel');

          // reject(new Error('reject'));
        resolve('setTimeout');
      }, 3000);
    });
  },
  (reason,operators) => {
    console.log('err', reason);
    return Promise.reject(reason);
  },
);

operators.run('chain run').then(console.log, console.log);

```

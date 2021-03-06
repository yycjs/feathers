import assert from 'assert';
import feathers from '../../src';

describe('`before` hooks', () => {
  describe('function([hook])', () => {
    it('hooks in chain can be replaced', async () => {
      const app = feathers().use('/dummy', {
        async get (id: any) {
          return {
            id, description: `You have to do ${id}`
          };
        }
      });
      const service = app.service('dummy');

      service.hooks({
        before: {
          get: [
            function (hook: any) {
              return Object.assign({}, hook, {
                modified: true
              });
            },
            function (hook: any) {
              assert.ok(hook.modified);
            }
          ]
        }
      });

      await service.get('laundry');
    });

    it('.before hooks can return a promise', async () => {
      const app = feathers().use('/dummy', {
        async get (id: any, params: any) {
          assert.ok(params.ran, 'Ran through promise hook');

          return {
            id,
            description: `You have to do ${id}`
          };
        },

        async remove () {
          assert.ok(false, 'Should never get here');
        }
      });
      const service = app.service('dummy');

      service.hooks({
        before: {
          get (hook: any) {
            return new Promise<void>(resolve => {
              hook.params.ran = true;
              resolve();
            });
          },

          remove () {
            return new Promise((_resolve, reject) => {
              reject(new Error('This did not work'));
            });
          }
        }
      });

      await service.get('dishes')
      await assert.rejects(() => service.remove(10), {
        message: 'This did not work'
      });
    });

    it('.before hooks do not need to return anything', async () => {
      const app = feathers().use('/dummy', {
        async get (id: any, params: any) {
          assert.ok(params.ran, 'Ran through promise hook');

          return {
            id,
            description: `You have to do ${id}`
          };
        },

        async remove () {
          assert.ok(false, 'Should never get here');
        }
      });
      const service = app.service('dummy');

      service.hooks({
        before: {
          get (hook: any) {
            hook.params.ran = true;
          },

          remove () {
            throw new Error('This did not work');
          }
        }
      });

      await service.get('dishes');
      await assert.rejects(() => service.remove(10), {
        message: 'This did not work'
      });
    });

    it('.before hooks can set hook.result which will skip service method', async () => {
      const app = feathers().use('/dummy', {
        async get () {
          assert.ok(false, 'This should never run');
        }
      });
      const service = app.service('dummy');

      service.hooks({
        before: {
          get (hook: any) {
            hook.result = {
              id: hook.id,
              message: 'Set from hook'
            };
          }
        }
      });

      const data = await service.get(10, {});

      assert.deepStrictEqual(data, {
        id: 10,
        message: 'Set from hook'
      });
    });
  });

  describe('function(hook, next)', () => {
    it('gets mixed into a service and modifies data', async () => {
      const dummyService = {
        async create (data: any, params: any) {
          assert.deepStrictEqual(data, {
            some: 'thing',
            modified: 'data'
          }, 'Data modified');

          assert.deepStrictEqual(params, {
            modified: 'params'
          }, 'Params modified');

          return data;
        }
      };
      const app = feathers().use('/dummy', dummyService);
      const service = app.service('dummy');

      service.hooks({
        before: {
          create (hook: any) {
            assert.strictEqual(hook.type, 'before');

            hook.data.modified = 'data';

            Object.assign(hook.params, {
              modified: 'params'
            });

            return hook;
          }
        }
      });

      const data = await service.create({ some: 'thing' });

      assert.deepStrictEqual(data, {
        some: 'thing',
        modified: 'data'
      }, 'Data got modified');
    });

    it('contains the app object at hook.app', async () => {
      const someServiceConfig = {
        async create (data: any) {
          return data;
        }
      };
      const app = feathers().use('/some-service', someServiceConfig);
      const someService = app.service('some-service');

      someService.hooks({
        before: {
          create (hook: any) {
            hook.data.appPresent = typeof hook.app !== 'undefined';
            assert.strictEqual(hook.data.appPresent, true);

            return hook;
          }
        }
      });

      const data = await someService.create({ some: 'thing' });

      assert.deepStrictEqual(data, {
        some: 'thing',
        appPresent: true
      }, 'App object was present');
    });

    it('passes errors', async () => {
      const dummyService = {
        update () {
          assert.ok(false, 'Never should be called');
        }
      };

      const app = feathers().use('/dummy', dummyService);
      const service = app.service('dummy');

      service.hooks({
        before: {
          update () {
            throw new Error('You are not allowed to update');
          }
        }
      });

      await assert.rejects(() => service.update(1, {}), {
        message: 'You are not allowed to update'
      });
    });

    it('calling back with no arguments uses the old ones', async () => {
      const dummyService = {
        async remove (id: any, params: any) {
          assert.strictEqual(id, 1, 'Got id');
          assert.deepStrictEqual(params, { my: 'param' });

          return { id };
        }
      };
      const app = feathers().use('/dummy', dummyService);
      const service = app.service('dummy');

      service.hooks({
        before: {
          remove (hook: any) {
            return hook;
          }
        }
      });

      await service.remove(1, { my: 'param' });
    });

    it('adds .hooks() and chains multiple hooks for the same method', async () => {
      const dummyService = {
        async create (data: any, params: any) {
          assert.deepStrictEqual(data, {
            some: 'thing',
            modified: 'second data'
          }, 'Data modified');

          assert.deepStrictEqual(params, {
            modified: 'params'
          }, 'Params modified');

          return data;
        }
      };
      const app = feathers().use('/dummy', dummyService);
      const service = app.service('dummy');

      service.hooks({
        before: {
          create (hook: any) {
            hook.params.modified = 'params';

            return hook;
          }
        }
      });

      service.hooks({
        before: {
          create (hook: any) {
            hook.data.modified = 'second data';

            return hook;
          }
        }
      });

      await service.create({ some: 'thing' });
    });

    it('chains multiple before hooks using array syntax', async () => {
      const dummyService = {
        async create (data: any, params: any) {
          assert.deepStrictEqual(data, {
            some: 'thing',
            modified: 'second data'
          }, 'Data modified');

          assert.deepStrictEqual(params, {
            modified: 'params'
          }, 'Params modified');

          return data;
        }
      };

      const app = feathers().use('/dummy', dummyService);
      const service = app.service('dummy');

      service.hooks({
        before: {
          create: [
            function (hook: any) {
              hook.params.modified = 'params';

              return hook;
            },
            function (hook: any) {
              hook.data.modified = 'second data';

              return hook;
            }
          ]
        }
      });

      await service.create({ some: 'thing' });
    });

    it('.before hooks run in the correct order (#13)', async () => {
      const app = feathers().use('/dummy', {
        async get (id: any, params: any) {
          assert.deepStrictEqual(params.items, ['first', 'second', 'third']);

          return {
            id,
            items: []
          };
        }
      });
      const service = app.service('dummy');

      service.hooks({
        before: {
          get (hook: any) {
            hook.params.items = ['first'];

            return hook;
          }
        }
      });

      service.hooks({
        before: {
          get: [
            function (hook: any) {
              hook.params.items.push('second');

              return hook;
            },
            function (hook: any) {
              hook.params.items.push('third');

              return hook;
            }
          ]
        }
      });

      await service.get(10);
    });

    it('before all hooks (#11)', async () => {
      const app = feathers().use('/dummy', {
        async get (id: any, params: any) {
          assert.ok(params.beforeAllObject);
          assert.ok(params.beforeAllMethodArray);

          return {
            id,
            items: []
          };
        },

        async find (params: any) {
          assert.ok(params.beforeAllObject);
          assert.ok(params.beforeAllMethodArray);

          return [];
        }
      });

      const service = app.service('dummy');

      service.hooks({
        before: {
          all (hook: any) {
            hook.params.beforeAllObject = true;

            return hook;
          }
        }
      });

      service.hooks({
        before: [
          function (hook: any) {
            hook.params.beforeAllMethodArray = true;

            return hook;
          }
        ]
      });

      await service.find();
    });

    it('before hooks have service as context and keep it in service method (#17)', async () => {
      const app = feathers().use('/dummy', {
        number: 42,
        async get (id: any, params: any) {
          return {
            id,
            number: (this as any).number,
            test: params.test
          };
        }
      });
      const service = app.service('dummy');

      service.hooks({
        before: {
          get (this: any, hook: any) {
            hook.params.test = this.number + 2;

            return hook;
          }
        }
      });

      const data = await service.get(10);

      assert.deepStrictEqual(data, {
        id: 10,
        number: 42,
        test: 44
      });
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { coordSplice, coordSet } from './coordCrudFunc';

describe('jsonPathSplice', () => {
  describe('基本删除操作', () => {
    it('应该删除数组中指定位置的元素', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const deleted = coordSplice(obj, 'items', 1, 2);
      expect(deleted).toEqual([2, 3]);
      expect(obj.items).toEqual([1, 4, 5]);
    });

    it('应该删除数组第一个元素', () => {
      const obj = { items: ['a', 'b', 'c'] };
      const deleted = coordSplice(obj, 'items', 0, 1);
      expect(deleted).toEqual(['a']);
      expect(obj.items).toEqual(['b', 'c']);
    });

    it('应该删除数组最后一个元素', () => {
      const obj = { items: [1, 2, 3] };
      const deleted = coordSplice(obj, 'items', 2, 1);
      expect(deleted).toEqual([3]);
      expect(obj.items).toEqual([1, 2]);
    });

    it('应该删除整个数组', () => {
      const obj = { items: [1, 2, 3] };
      const deleted = coordSplice(obj, 'items', 0, 3);
      expect(deleted).toEqual([1, 2, 3]);
      expect(obj.items).toEqual([]);
    });
  });

  describe('删除并插入元素', () => {
    it('应该在指定位置删除并插入新元素', () => {
      const obj = { items: [1, 2, 3, 4] };
      const deleted = coordSplice(obj, 'items', 1, 2, 9, 8);
      expect(deleted).toEqual([2, 3]);
      expect(obj.items).toEqual([1, 9, 8, 4]);
    });

    it('应该在数组开头删除并插入元素', () => {
      const obj = { items: ['b', 'c'] };
      const deleted = coordSplice(obj, 'items', 0, 1, 'a');
      expect(deleted).toEqual(['b']);
      expect(obj.items).toEqual(['a', 'c']);
    });

    it('应该在数组末尾删除并插入元素', () => {
      const obj = { items: [1, 2] };
      const deleted = coordSplice(obj, 'items', 2, 0, 3, 4);
      expect(deleted).toEqual([]);
      expect(obj.items).toEqual([1, 2, 3, 4]);
    });

    it('应该支持插入多个元素', () => {
      const obj = { items: [1] };
      const deleted = coordSplice(obj, 'items', 1, 0, 2, 3, 4, 5);
      expect(deleted).toEqual([]);
      expect(obj.items).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('仅插入不删除', () => {
    it('应该在指定位置插入元素而不删除任何元素', () => {
      const obj = { items: [1, 3] };
      const deleted = coordSplice(obj, 'items', 1, 0, 2);
      expect(deleted).toEqual([]);
      expect(obj.items).toEqual([1, 2, 3]);
    });

    it('应该在数组开头插入元素', () => {
      const obj = { items: [2, 3] };
      const deleted = coordSplice(obj, 'items', 0, 0, 1);
      expect(deleted).toEqual([]);
      expect(obj.items).toEqual([1, 2, 3]);
    });

    it('应该在数组末尾插入元素', () => {
      const obj = { items: [1, 2] };
      const deleted = coordSplice(obj, 'items', 2, 0, 3);
      expect(deleted).toEqual([]);
      expect(obj.items).toEqual([1, 2, 3]);
    });
  });

  describe('负索引处理', () => {
    it('应该支持负索引从数组末尾删除', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const deleted = coordSplice(obj, 'items', -2, 1);
      expect(deleted).toEqual([4]);
      expect(obj.items).toEqual([1, 2, 3, 5]);
    });

    it('应该支持负索引删除末尾多个元素', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const deleted = coordSplice(obj, 'items', -3, 2);
      expect(deleted).toEqual([3, 4]);
      expect(obj.items).toEqual([1, 2, 5]);
    });

    it('应该在负索引位置插入元素', () => {
      const obj = { items: [1, 2, 3] };
      const deleted = coordSplice(obj, 'items', -1, 0, 99);
      expect(deleted).toEqual([]);
      expect(obj.items).toEqual([1, 2, 99, 3]);
    });
  });

  describe('嵌套路径操作', () => {
    it('应该操作嵌套对象中的数组', () => {
      const obj = { data: { items: [10, 20, 30] } };
      const deleted = coordSplice(obj, 'data.items', 1, 1, 25);
      expect(deleted).toEqual([20]);
      expect(obj.data.items).toEqual([10, 25, 30]);
    });

    it('应该操作深层嵌套的数组', () => {
      const obj = { a: { b: { c: [1, 2, 3] } } };
      const deleted = coordSplice(obj, 'a.b.c', 0, 1);
      expect(deleted).toEqual([1]);
      expect(obj.a.b.c).toEqual([2, 3]);
    });

    it('应该支持括号表示法访问属性', () => {
      const obj = { 'my-array': [1, 2, 3] };
      const deleted = coordSplice(obj, "my-array", 0, 1);
      expect(deleted).toEqual([1]);
      expect(obj['my-array']).toEqual([2, 3]);
    });
  });

  describe('错误处理', () => {
    it('当路径未匹配时应返回空数组', () => {
      const obj = { items: [1, 2, 3] };
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const deleted = coordSplice(obj, 'nonexistent', 0, 1);
      expect(deleted).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('未匹配到任何对象')
      );
      consoleWarnSpy.mockRestore();
    });

    it('当深层路径未匹配时应返回空数组', () => {
      const obj = { data: { items: [1, 2, 3] } };
      const deleted = coordSplice(obj, 'data.nested.path', 0, 1);
      expect(deleted).toEqual([]);
    });

    it('当匹配到非数组类型时应返回空数组', () => {
      const obj = { value: 'not an array' };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const deleted = coordSplice(obj, 'value', 0, 1);
      expect(deleted).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('匹配到非数组类型')
      );
      consoleErrorSpy.mockRestore();
    });

    it('当嵌套路径指向非数组时应返回空数组', () => {
      const obj = { data: { items: 'string' } };
      const deleted = coordSplice(obj, 'data.items', 0, 1);
      expect(deleted).toEqual([]);
    });

    it('当数组为空时应正常处理', () => {
      const obj = { items: [] };
      const deleted = coordSplice(obj, 'items', 0, 0, 'first');
      expect(deleted).toEqual([]);
      expect(obj.items).toEqual(['first']);
    });
  });

  describe('异常处理', () => {
    it('当路径访问出错时应捕获异常并返回空数组', () => {
      const obj = { items: [1, 2, 3] };
      const deleted = coordSplice(obj, 'items[999999]', 0, 1);
      expect(deleted).toEqual([]);
    });
  });

  describe('类型测试', () => {
    it('应该正确返回被删除元素的类型', () => {
      interface User {
        name: string;
        age: number;
      }
      const obj: { users: User[] } = { users: [{ name: 'A', age: 20 }, { name: 'B', age: 30 }] };
      const deleted = coordSplice(obj, 'users', 0, 1);
      expect(deleted).toEqual([{ name: 'A', age: 20 }]);
      expect(deleted[0]).toHaveProperty('name');
      expect(deleted[0]).toHaveProperty('age');
    });

    it('应该支持插入不同类型的元素', () => {
      const obj = { mixed: [1, 'two', { three: 3 }] };
      const deleted = coordSplice(obj, 'mixed', 1, 1, true, null, 42);
      expect(deleted).toEqual(['two']);
      expect(obj.mixed).toEqual([1, true, null, 42, { three: 3 }]);
    });
  });

  describe('复杂场景测试', () => {
    it('应该处理替换整个子数组的场景', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const deleted = coordSplice(obj, 'items', 1, 3, 'a', 'b', 'c');
      expect(deleted).toEqual([2, 3, 4]);
      expect(obj.items).toEqual([1, 'a', 'b', 'c', 5]);
    });

    it('应该处理清空数组的场景', () => {
      const obj = { items: [1, 2, 3] };
      const deleted = coordSplice(obj, 'items', 0, 3);
      expect(deleted).toEqual([1, 2, 3]);
      expect(obj.items).toEqual([]);
    });

    it('应该处理删除不存在的索引范围', () => {
      const obj = { items: [1, 2] };
      const deleted = coordSplice(obj, 'items', 5, 10);
      expect(deleted).toEqual([]);
      expect(obj.items).toEqual([1, 2]);
    });

    it('应该处理边界索引', () => {
      const obj = { items: [1, 2, 3] };
      const deleted = coordSplice(obj, 'items', 1, 0, 99);
      expect(deleted).toEqual([]);
      expect(obj.items).toEqual([1, 99, 2, 3]);
    });
  });
});

describe('jsonPathSet', () => {
  describe('基本设置操作', () => {
    it('应该设置对象中指定路径的值', () => {
      const obj = { name: '张三', age: 25 };
      const result = coordSet(obj, 'name', '李四');
      expect(result).toBe(true);
      expect(obj.name).toBe('李四');
    });

    it('应该设置嵌套对象中的值', () => {
      const obj = { user: { profile: { name: '张三' } } };
      const result = coordSet(obj, 'user.profile.name', '王五');
      expect(result).toBe(true);
      expect(obj.user.profile.name).toBe('王五');
    });

    it('应该设置数组元素的值', () => {
      const obj = { items: [1, 2, 3] };
      const result = coordSet(obj, 'items[1]', 99);
      expect(result).toBe(true);
      expect(obj.items[1]).toBe(99);
    });

    it('应该支持点语法和方括号混合', () => {
      const obj = { users: [{ name: 'A' }, { name: 'B' }] };
      const result = coordSet(obj, 'users[0].name', 'NewA');
      expect(result).toBe(true);
      expect(obj?.users[0]?.name).toBe('NewA');
    });
  });

  describe('各种类型设置', () => {
    it('应该支持设置字符串', () => {
      const obj = { value: '' };
      expect(coordSet(obj, 'value', 'hello')).toBe(true);
      expect(obj.value).toBe('hello');
    });

    it('应该支持设置数字', () => {
      const obj = { value: 0 };
      expect(coordSet(obj, 'value', 42)).toBe(true);
      expect(obj.value).toBe(42);
    });

    it('应该支持设置布尔值', () => {
      const obj = { value: false };
      expect(coordSet(obj, 'value', true)).toBe(true);
      expect(obj.value).toBe(true);
    });

    it('应该支持设置数组', () => {
      const obj = { value: [] };
      expect(coordSet(obj, 'value', [1, 2, 3])).toBe(true);
      expect(obj.value).toEqual([1, 2, 3]);
    });

    it('应该支持设置对象', () => {
      const obj = { value: null };
      expect(coordSet(obj, 'value', { key: 'value' })).toBe(true);
      expect(obj.value).toEqual({ key: 'value' });
    });
  });

  describe('错误处理', () => {
    it('当路径未匹配且无中间路径时应返回 false', () => {
      const obj = { items: null };
      const result = coordSet(obj, 'items.nested.value', 'test');
      expect(result).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('空对象匹配不到不处理，与lodash set不完全相同', () => {
      const obj = {};
      const result = coordSet(obj, 'name', 'test');
      expect(result).toBe(false);
      expect(obj).toEqual({});
    });

    it('应该处理顶层数组路径', () => {
      const arr = [1, 2, 3];
      const result = coordSet(arr, '[0]', 99);
      expect(result).toBe(true);
      expect(arr[0]).toBe(99);
    });

    it('应该处理数组中的对象路径', () => {
      const obj = { users: [{ name: 'A' }, { name: 'B' }] };
      const result = coordSet(obj, 'users[1].name', 'NewB');
      expect(result).toBe(true);
      expect(obj?.users[1]?.name).toBe('NewB');
    });
  });

  describe('类型测试', () => {
    it('应该正确推断类型', () => {
      const obj = { value: 1 };
      const result = coordSet(obj, 'value', 'string');
      expect(result).toBe(true);
    });

    it('应该支持泛型类型', () => {
      interface User {
        id: number;
        name: string;
      }
      const obj: { user: User } = { user: { id: 1, name: 'test' } };
      const result = coordSet(obj, 'user', { id: 2, name: 'updated' } as User);
      expect(result).toBe(true);
      expect(obj.user).toEqual({ id: 2, name: 'updated' });
    });
  });
});

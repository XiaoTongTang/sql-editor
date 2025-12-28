import { describe, expect, it, vi } from 'vitest';
import { coordSplice, coordSet } from './coordCrudFunc';

describe('coordSplice 逆操作测试', () => {
  describe('只删除操作的逆操作', () => {
    it('正向删除元素后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 1, deleteCount: 2, items: [] });
      expect(result.deletedItems).toEqual([2, 3]);
      expect(obj.items).toEqual([1, 4, 5]);

      expect(result.reverseParams).not.toBeNull();
      const undoResult = coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
      expect(undoResult.deletedItems).toEqual([]);
    });

    it('正向删除第一个元素后，逆向应该能完全还原', () => {
      const obj = { items: ['a', 'b', 'c'] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 0, deleteCount: 1, items: [] });
      expect(result.deletedItems).toEqual(['a']);
      expect(obj.items).toEqual(['b', 'c']);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });

    it('正向删除最后一个元素后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2, 3] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 2, deleteCount: 1, items: [] });
      expect(result.deletedItems).toEqual([3]);
      expect(obj.items).toEqual([1, 2]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });

    it('正向清空数组后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2, 3] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 0, deleteCount: 3, items: [] });
      expect(result.deletedItems).toEqual([1, 2, 3]);
      expect(obj.items).toEqual([]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });
  });

  describe('只插入操作的逆操作', () => {
    it('正向插入元素后，逆向应该能完全还原', () => {
      const obj = { items: [1, 3] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 1, deleteCount: 0, items: [2] });
      expect(result.deletedItems).toEqual([]);
      expect(obj.items).toEqual([1, 2, 3]);

      expect(result.reverseParams).not.toBeNull();
      expect(result.reverseParams!.deleteCount).toBe(1);
      expect(result.reverseParams!.items).toEqual([]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });

    it('正向从开头插入元素后，逆向应该能完全还原', () => {
      const obj = { items: [2, 3] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 0, deleteCount: 0, items: [1] });
      expect(obj.items).toEqual([1, 2, 3]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });

    it('正向从末尾插入多个元素后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 2, deleteCount: 0, items: [3, 4, 5] });
      expect(obj.items).toEqual([1, 2, 3, 4, 5]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });
  });

  describe('删除并插入的逆操作', () => {
    it('正向替换元素后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2, 3, 4] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 1, deleteCount: 2, items: [9, 8] });
      expect(result.deletedItems).toEqual([2, 3]);
      expect(obj.items).toEqual([1, 9, 8, 4]);

      expect(result.reverseParams).not.toBeNull();
      expect(result.reverseParams!.deleteCount).toBe(2);
      expect(result.reverseParams!.items).toEqual([2, 3]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });

    it('正向删除并插入不同数量的元素后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 1, deleteCount: 3, items: ['a'] });
      expect(result.deletedItems).toEqual([2, 3, 4]);
      expect(obj.items).toEqual([1, 'a', 5]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });

    it('正向删除0个插入多个元素后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 1, deleteCount: 0, items: ['a', 'b', 'c'] });
      expect(result.deletedItems).toEqual([]);
      expect(obj.items).toEqual([1, 'a', 'b', 'c', 2]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });
  });

  describe('负索引的逆操作', () => {
    it('正向使用负索引删除后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: -2, deleteCount: 1, items: [] });
      expect(result.deletedItems).toEqual([4]);
      expect(obj.items).toEqual([1, 2, 3, 5]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });

    it('正向使用负索引删除多个后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: -3, deleteCount: 2, items: [] });
      expect(result.deletedItems).toEqual([3, 4]);
      expect(obj.items).toEqual([1, 2, 5]);
      console.log(obj);
      console.log(result.reverseParams);
      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });

    it('正向使用负索引插入后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2, 3] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: -1, deleteCount: 0, items: [99] });
      expect(obj.items).toEqual([1, 2, 99, 3]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });
  });

  describe('嵌套路径的逆操作', () => {
    it('正向操作嵌套数组后，逆向应该能完全还原', () => {
      const obj = { data: { items: [10, 20, 30] } };
      const original = JSON.stringify(obj.data.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'data.items', start: 1, deleteCount: 1, items: [25] });
      expect(result.deletedItems).toEqual([20]);
      expect(obj.data.items).toEqual([10, 25, 30]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.data.items)).toBe(original);
    });

    it('正向操作深层嵌套数组后，逆向应该能完全还原', () => {
      const obj = { a: { b: { c: [1, 2, 3] } } };
      const original = JSON.stringify(obj.a.b.c);

      const result = coordSplice({ rootObj: obj, editCoord: 'a.b.c', start: 0, deleteCount: 1, items: [] });
      expect(result.deletedItems).toEqual([1]);
      expect(obj.a.b.c).toEqual([2, 3]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.a.b.c)).toBe(original);
    });

    it('正向操作数组中的数组后，逆向应该能完全还原', () => {
      const obj = { matrix: [[1, 2], [3, 4], [5, 6]] };
      const original = JSON.stringify(obj.matrix);

      const result = coordSplice({ rootObj: obj, editCoord: 'matrix[1]', start: 0, deleteCount: 1, items: [99] });
      expect(result.deletedItems).toEqual([3]);
      expect(obj.matrix).toEqual([[1, 2], [99, 4], [5, 6]]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.matrix)).toBe(original);
    });
  });

  describe('复杂场景的逆操作', () => {
    it('正向替换整个子数组后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 1, deleteCount: 3, items: ['a', 'b', 'c'] });
      expect(result.deletedItems).toEqual([2, 3, 4]);
      expect(obj.items).toEqual([1, 'a', 'b', 'c', 5]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });

    it('正向多次操作后连续逆向应该能完全还原', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const original = JSON.stringify(obj.items);

      const result1 = coordSplice({ rootObj: obj, editCoord: 'items', start: 1, deleteCount: 2, items: ['a'] });
      expect(obj.items).toEqual([1, 'a', 4, 5]);

      const result2 = coordSplice({ rootObj: obj, editCoord: 'items', start: 2, deleteCount: 1, items: ['b'] });
      expect(obj.items).toEqual([1, 'a', 'b', 5]);

      coordSplice(result2.reverseParams!);
      expect(obj.items).toEqual([1, 'a', 4, 5]);

      coordSplice(result1.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });

    it('正向操作边界索引后，逆向应该能完全还原', () => {
      const obj = { items: [1, 2, 3] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 1, deleteCount: 0, items: [99] });
      expect(obj.items).toEqual([1, 99, 2, 3]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });

    it('正向删除不存在的索引范围后，逆向应该无变化', () => {
      const obj = { items: [1, 2] };
      const original = JSON.stringify(obj.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'items', start: 5, deleteCount: 10, items: [] });
      expect(result.deletedItems).toEqual([]);
      expect(result.reverseParams!.deleteCount).toBe(0);
      expect(obj.items).toEqual([1, 2]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.items)).toBe(original);
    });
  });

  describe('对象类型元素的逆操作', () => {
    it('正向删除对象元素后，逆向应该能完全还原', () => {
      const obj = { users: [{ name: 'A', age: 20 }, { name: 'B', age: 30 }] };
      const original = JSON.stringify(obj.users);

      const result = coordSplice({ rootObj: obj, editCoord: 'users', start: 0, deleteCount: 1, items: [] });
      expect(result.deletedItems).toEqual([{ name: 'A', age: 20 }]);
      expect(obj.users).toEqual([{ name: 'B', age: 30 }]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.users)).toBe(original);
    });

    it('正向删除复杂嵌套对象后，逆向应该能完全还原', () => {
      const obj = { data: { items: [{ a: 1 }, { b: 2 }, { c: 3 }] } };
      const original = JSON.stringify(obj.data.items);

      const result = coordSplice({ rootObj: obj, editCoord: 'data.items', start: 1, deleteCount: 1, items: [{ x: 99 }] });
      expect(result.deletedItems).toEqual([{ b: 2 }]);
      expect(obj.data.items).toEqual([{ a: 1 }, { x: 99 }, { c: 3 }]);

      coordSplice(result.reverseParams!);
      expect(JSON.stringify(obj.data.items)).toBe(original);
    });
  });


});

describe('jsonPathSplice', () => {
  describe('基本删除操作', () => {
    it('应该删除数组中指定位置的元素', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 1, deleteCount: 2, items: []});
      expect(result.deletedItems).toEqual([2, 3]);
      expect(obj.items).toEqual([1, 4, 5]);
    });

    it('应该删除数组第一个元素', () => {
      const obj = { items: ['a', 'b', 'c'] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 0, deleteCount: 1, items: []});
      expect(result.deletedItems).toEqual(['a']);
      expect(obj.items).toEqual(['b', 'c']);
    });

    it('应该删除数组最后一个元素', () => {
      const obj = { items: [1, 2, 3] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 2, deleteCount: 1, items: []});
      expect(result.deletedItems).toEqual([3]);
      expect(obj.items).toEqual([1, 2]);
    });

    it('应该删除整个数组', () => {
      const obj = { items: [1, 2, 3] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 0, deleteCount: 3, items: []});
      expect(result.deletedItems).toEqual([1, 2, 3]);
      expect(obj.items).toEqual([]);
    });
  });

  describe('删除并插入元素', () => {
    it('应该在指定位置删除并插入新元素', () => {
      const obj = { items: [1, 2, 3, 4] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 1, deleteCount: 2, items: [9, 8]});
      expect(result.deletedItems).toEqual([2, 3]);
      expect(obj.items).toEqual([1, 9, 8, 4]);
    });

    it('应该在数组开头删除并插入元素', () => {
      const obj = { items: ['b', 'c'] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 0, deleteCount: 1, items: ['a']});
      expect(result.deletedItems).toEqual(['b']);
      expect(obj.items).toEqual(['a', 'c']);
    });

    it('应该在数组末尾删除并插入元素', () => {
      const obj = { items: [1, 2] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 2, deleteCount: 0, items: [3, 4]});
      expect(result.deletedItems).toEqual([]);
      expect(obj.items).toEqual([1, 2, 3, 4]);
    });

    it('应该支持插入多个元素', () => {
      const obj = { items: [1] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 1, deleteCount: 0, items: [2, 3, 4, 5]});
      expect(result.deletedItems).toEqual([]);
      expect(obj.items).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('仅插入不删除', () => {
    it('应该在指定位置插入元素而不删除任何元素', () => {
      const obj = { items: [1, 3] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 1, deleteCount: 0, items: [2]});
      expect(result.deletedItems).toEqual([]);
      expect(obj.items).toEqual([1, 2, 3]);
    });

    it('应该在数组开头插入元素', () => {
      const obj = { items: [2, 3] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 0, deleteCount: 0, items: [1]});
      expect(result.deletedItems).toEqual([]);
      expect(obj.items).toEqual([1, 2, 3]);
    });

    it('应该在数组末尾插入元素', () => {
      const obj = { items: [1, 2] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 2, deleteCount: 0, items: [3]});
      expect(result.deletedItems).toEqual([]);
      expect(obj.items).toEqual([1, 2, 3]);
    });
  });

  describe('负索引处理', () => {
    it('应该支持负索引从数组末尾删除', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: -2, deleteCount: 1, items: []});
      expect(result.deletedItems).toEqual([4]);
      expect(obj.items).toEqual([1, 2, 3, 5]);
    });

    it('应该支持负索引删除末尾多个元素', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: -3, deleteCount: 2, items: []});
      expect(result.deletedItems).toEqual([3, 4]);
      expect(obj.items).toEqual([1, 2, 5]);
    });

    it('应该在负索引位置插入元素', () => {
      const obj = { items: [1, 2, 3] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: -1, deleteCount: 0, items: [99]});
      expect(result.deletedItems).toEqual([]);
      expect(obj.items).toEqual([1, 2, 99, 3]);
    });
  });

  describe('嵌套路径操作', () => {
    it('应该操作嵌套对象中的数组', () => {
      const obj = { data: { items: [10, 20, 30] } };
      const result = coordSplice({rootObj: obj, editCoord: 'data.items', start: 1, deleteCount: 1, items: [25]});
      expect(result.deletedItems).toEqual([20]);
      expect(obj.data.items).toEqual([10, 25, 30]);
    });

    it('应该操作深层嵌套的数组', () => {
      const obj = { a: { b: { c: [1, 2, 3] } } };
      const result = coordSplice({rootObj: obj, editCoord: 'a.b.c', start: 0, deleteCount: 1, items: []});
      expect(result.deletedItems).toEqual([1]);
      expect(obj.a.b.c).toEqual([2, 3]);
    });

    it('应该支持括号表示法访问属性', () => {
      const obj = { 'my-array': [1, 2, 3] };
      const result = coordSplice({rootObj: obj, editCoord: 'my-array', start: 0, deleteCount: 1, items: []});  
      expect(result.deletedItems).toEqual([1]);
      expect(obj['my-array']).toEqual([2, 3]);
    });
  });

  describe('错误处理', () => {
    it('当路径未匹配时应返回空数组', () => {
      const obj = { items: [1, 2, 3] };
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = coordSplice({rootObj: obj, editCoord: 'nonexistent', start: 0, deleteCount: 1, items: []});
      expect(result.deletedItems).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('未匹配到任何对象')
      );
      consoleWarnSpy.mockRestore();
    });

    it('当深层路径未匹配时应返回空数组', () => {
      const obj = { data: { items: [1, 2, 3] } };
      const result = coordSplice({rootObj: obj, editCoord: 'data.nested.path', start: 0, deleteCount: 1, items: []});
      expect(result.deletedItems).toEqual([]);
    });

    it('当匹配到非数组类型时应返回空数组', () => {
      const obj = { value: 'not an array' };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = coordSplice({rootObj: obj, editCoord: 'value', start: 0, deleteCount: 1, items: []});
      expect(result.deletedItems).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('匹配到非数组类型')
      );
      consoleErrorSpy.mockRestore();
    });

    it('当嵌套路径指向非数组时应返回空数组', () => {
      const obj = { data: { items: 'string' } };
      const result = coordSplice({rootObj: obj, editCoord: 'data.items', start: 0, deleteCount: 1, items: []});
      expect(result.deletedItems).toEqual([]);
    });

    it('当数组为空时应正常处理', () => {
      const obj = { items: [] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 0, deleteCount: 0, items: ['first']});
      expect(result.deletedItems).toEqual([]);
      expect(obj.items).toEqual(['first']);
    });
  });

  describe('异常处理', () => {
    it('当路径访问出错时应捕获异常并返回空数组', () => {
      const obj = { items: [1, 2, 3] };
      const result = coordSplice({rootObj: obj, editCoord: 'items[999999]', start: 0, deleteCount: 1, items: []});
      expect(result.deletedItems).toEqual([]);
    });
  });

  describe('类型测试', () => {
    it('应该正确返回被删除元素的类型', () => {
      interface User {
        name: string;
        age: number;
      }
      const obj: { users: User[] } = { users: [{ name: 'A', age: 20 }, { name: 'B', age: 30 }] };
      const result = coordSplice({rootObj: obj, editCoord: 'users', start: 0, deleteCount: 1, items: []});
      expect(result.deletedItems).toEqual([{ name: 'A', age: 20 }]);
      expect(result.deletedItems[0]).toHaveProperty('name');
      expect(result.deletedItems[0]).toHaveProperty('age');
    });

    it('应该支持插入不同类型的元素', () => {
      const obj = { mixed: [1, 'two', { three: 3 }] };
      const result = coordSplice({rootObj: obj, editCoord: 'mixed', start: 1, deleteCount: 1, items: [true, null, 42]});
      expect(result.deletedItems).toEqual(['two']);
      expect(obj.mixed).toEqual([1, true, null, 42, { three: 3 }]);
    });
  });

  describe('复杂场景测试', () => {
    it('应该处理替换整个子数组的场景', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 1, deleteCount: 3, items: ['a', 'b', 'c']});
      expect(result.deletedItems).toEqual([2, 3, 4]);
      expect(obj.items).toEqual([1, 'a', 'b', 'c', 5]);
    });

    it('应该处理清空数组的场景', () => {
      const obj = { items: [1, 2, 3] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 0, deleteCount: 3, items: []});
      expect(result.deletedItems).toEqual([1, 2, 3]);
      expect(obj.items).toEqual([]);
    });

    it('应该处理删除不存在的索引范围', () => {
      const obj = { items: [1, 2] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 5, deleteCount: 10, items: []});
      expect(result.deletedItems).toEqual([]);
      expect(obj.items).toEqual([1, 2]);
    });

    it('应该处理边界索引', () => {
      const obj = { items: [1, 2, 3] };
      const result = coordSplice({rootObj: obj, editCoord: 'items', start: 1, deleteCount: 0, items: [99]});
      expect(result.deletedItems).toEqual([]);
      expect(obj.items).toEqual([1, 99, 2, 3]);
    });
  });
});

describe('jsonPathSet', () => {
  describe('基本设置操作', () => {
    it('应该设置对象中指定路径的值', () => {
      const obj = { name: '张三', age: 25 };
      const result = coordSet({ rootObj: obj, editCoord: 'name', newValue: '李四' });
      expect(result.oldValue).toBe('张三');
      expect(result.reverseParams).not.toBeNull();
      expect(obj.name).toBe('李四');
    });

    it('应该设置嵌套对象中的值', () => {
      const obj = { user: { profile: { name: '张三' } } };
      const result = coordSet({ rootObj: obj, editCoord: 'user.profile.name', newValue: '王五' });
      expect(result.oldValue).toBe('张三');
      expect(result.reverseParams).not.toBeNull();
      expect(obj.user.profile.name).toBe('王五');
    });

    it('应该设置数组元素的值', () => {
      const obj = { items: [1, 2, 3] };
      const result = coordSet({ rootObj: obj, editCoord: 'items[1]', newValue: 99 });
      expect(result.oldValue).toBe(2);
      expect(result.reverseParams).not.toBeNull();
      expect(obj.items[1]).toBe(99);
    });

    it('应该支持点语法和方括号混合', () => {
      const obj = { users: [{ name: 'A' }, { name: 'B' }] };
      const result = coordSet({ rootObj: obj, editCoord: 'users[0].name', newValue: 'NewA' });
      expect(result.oldValue).toBe('A');
      expect(result.reverseParams).not.toBeNull();
      expect(obj?.users[0]?.name).toBe('NewA');
    });
  });

  describe('各种类型设置', () => {
    it('应该支持设置字符串', () => {
      const obj = { value: '' };
      const result = coordSet({ rootObj: obj, editCoord: 'value', newValue: 'hello' });
      expect(result.oldValue).toBe('');
      expect(obj.value).toBe('hello');
    });

    it('应该支持设置数字', () => {
      const obj = { value: 0 };
      const result = coordSet({ rootObj: obj, editCoord: 'value', newValue: 42 });
      expect(result.oldValue).toBe(0);
      expect(obj.value).toBe(42);
    });

    it('应该支持设置布尔值', () => {
      const obj = { value: false };
      const result = coordSet({ rootObj: obj, editCoord: 'value', newValue: true });
      expect(result.oldValue).toBe(false);
      expect(obj.value).toBe(true);
    });

    it('应该支持设置数组', () => {
      const obj = { value: [] };
      const result = coordSet({ rootObj: obj, editCoord: 'value', newValue: [1, 2, 3] });
      expect(result.oldValue).toEqual([]);
      expect(obj.value).toEqual([1, 2, 3]);
    });

    it('应该支持设置对象', () => {
      const obj = { value: null };
      const result = coordSet({ rootObj: obj, editCoord: 'value', newValue: { key: 'value' } });
      expect(result.oldValue).toBeNull();
      expect(obj.value).toEqual({ key: 'value' });
    });
  });

  describe('错误处理', () => {
    it('当路径未匹配且无中间路径时应返回空reverseParams', () => {
      const obj = { items: null };
      const result = coordSet({ rootObj: obj, editCoord: 'items.nested.value', newValue: 'test' });
      expect(result.oldValue).toBeUndefined();
      expect(result.reverseParams).toBeNull();
    });
  });

  describe('边界情况', () => {
    it('空对象匹配不到不处理，与lodash set不完全相同', () => {
      const obj = {};
      const result = coordSet({ rootObj: obj, editCoord: 'name', newValue: 'test' });
      expect(result.oldValue).toBeUndefined();
      expect(result.reverseParams).toBeNull();
      expect(obj).toEqual({});
    });

    it('应该处理顶层数组路径', () => {
      const arr = [1, 2, 3];
      const result = coordSet({ rootObj: arr, editCoord: '[0]', newValue: 99 });
      expect(result.oldValue).toBe(1);
      expect(result.reverseParams).not.toBeNull();
      expect(arr[0]).toBe(99);
    });

    it('应该处理数组中的对象路径', () => {
      const obj = { users: [{ name: 'A' }, { name: 'B' }] };
      const result = coordSet({ rootObj: obj, editCoord: 'users[1].name', newValue: 'NewB' });
      expect(result.oldValue).toBe('B');
      expect(result.reverseParams).not.toBeNull();
      expect(obj?.users[1]?.name).toBe('NewB');
    });
  });

  describe('类型测试', () => {
    it('应该正确推断类型', () => {
      const obj = { value: 1 };
      const result = coordSet({ rootObj: obj, editCoord: 'value', newValue: 'string' });
      expect(result.oldValue).toBe(1);
      expect(obj.value).toBe('string');
    });

    it('应该支持泛型类型', () => {
      interface User {
        id: number;
        name: string;
      }
      const obj: { user: User } = { user: { id: 1, name: 'test' } };
      const result = coordSet({ rootObj: obj, editCoord: 'user', newValue: { id: 2, name: 'updated' } });
      expect(result.oldValue).toEqual({ id: 1, name: 'test' });
      expect(obj.user).toEqual({ id: 2, name: 'updated' });
    });
  });

  describe('逆操作测试', () => {
    it('正向设置后，逆向应该能完全还原', () => {
      const obj = { value: 10 };
      const original = obj.value;

      const result = coordSet({ rootObj: obj, editCoord: 'value', newValue: 20 });
      expect(obj.value).toBe(20);

      expect(result.reverseParams).not.toBeNull();
      coordSet(result.reverseParams!);
      expect(obj.value).toBe(original);
    });

    it('正向设置嵌套路径后，逆向应该能完全还原', () => {
      const obj = { data: { items: [{ value: 1 }, { value: 2 }] } };
      const original = JSON.stringify(obj);

      const result = coordSet({ rootObj: obj, editCoord: 'data.items[0].value', newValue: 99 });
      expect(obj?.data?.items[0]?.value).toBe(99);

      coordSet(result.reverseParams!);
      expect(JSON.stringify(obj)).toBe(original);
    });

    it('正向多次设置后连续逆向应该能完全还原', () => {
      const obj = { a: 1, b: 2 };

      const result1 = coordSet({ rootObj: obj, editCoord: 'a', newValue: 10 });
      expect(obj.a).toBe(10);

      const result2 = coordSet({ rootObj: obj, editCoord: 'b', newValue: 20 });
      expect(obj.b).toBe(20);

      coordSet(result2.reverseParams!);
      expect(obj.b).toBe(2);

      coordSet(result1.reverseParams!);
      expect(obj.a).toBe(1);
    });

    it('正向设置复杂对象后，逆向应该能完全还原', () => {
      const obj = { user: { id: 1, name: 'test', tags: ['a', 'b'] } };
      const original = JSON.stringify(obj);

      const result = coordSet({ rootObj: obj, editCoord: 'user', newValue: { id: 2, name: 'updated' } });
      expect(obj.user).toEqual({ id: 2, name: 'updated' });

      coordSet(result.reverseParams!);
      expect(JSON.stringify(obj)).toBe(original);
    });
  });
});

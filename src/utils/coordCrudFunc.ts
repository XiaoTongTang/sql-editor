import { get, set } from 'lodash';

export function coordSplice<T = unknown>(
  rootObj: Record<string, unknown> | Array<unknown>,
  editCoord: string,
  start: number,
  deleteCount: number,
  ...items: unknown[]
): unknown[] {
  try {
    const target = get(rootObj, editCoord);

    if (target === undefined) {
      console.warn(`coordSplice: 路径 "${editCoord}" 未匹配到任何对象`);
      return [];
    }

    if (!Array.isArray(target)) {
      console.error(`coordSplice: 路径 "${editCoord}" 匹配到非数组类型，类型为 ${typeof target}`);
      return [];
    }

    const targetArray = target as T[];
    const deletedItems = targetArray.splice(start, deleteCount, ...(items as T[]));

    return deletedItems as T[];
  } catch (error) {
    console.error(`coordSplice 执行异常：`, error);
    return [];
  }
}

export function coordSet<T = unknown>(
  rootObj: Record<string, unknown> | Array<unknown>,
  editCoord: string,
  newValue: T
): boolean {
  try {
    const oldValue = get(rootObj, editCoord);

    if (oldValue === undefined) {
      console.warn(`coordSet: 路径 "${editCoord}" 未匹配到任何节点`);
      return false;
    }

    set(rootObj, editCoord, newValue);
    return true;
  } catch (error) {
    console.error(`coordSet 执行失败：`, error);
    return false;
  }
}
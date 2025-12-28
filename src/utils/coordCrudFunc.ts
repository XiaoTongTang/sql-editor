import { get, set } from 'lodash';

export interface CoordSpliceParams {
  rootObj: Record<string, unknown> | Array<unknown>,
  editCoord: string,
  start: number,
  deleteCount: number,
  items: unknown[]
}

export interface CoordSpliceResult<T = unknown> {
  deletedItems: T[]; // 被splice删除的项
  reverseParams: CoordSpliceParams | null; // 逆操作参数（用于撤销splice操作）
}

export interface CoordSetParams {
  rootObj: Record<string, unknown> | Array<unknown>,
  editCoord: string,
  newValue: unknown
}

export interface CoordSetResult<T = unknown> {
  oldValue: T; // 被覆盖的旧值
  reverseParams: CoordSetParams | null; // 逆操作参数（用于撤销set操作）
}

/**
 * 校验对象是否为有效的 CoordSpliceParams
 * @param value 要校验的值
 * @returns 是否为有效的 CoordSpliceParams
 */
export function isCoordSpliceParams(value: unknown): value is CoordSpliceParams {
  if (value === null || value === undefined) {
    return false;
  }
  const params = value as Record<string, unknown>;
  if (!('rootObj' in params)) {
    return false;
  }
  if (!('editCoord' in params)) {
    return false;
  }
  if (!('start' in params)) {
    return false;
  }
  if (!('deleteCount' in params)) {
    return false;
  }
  if (!('items' in params)) {
    return false;
  }
  return true;
}

/**
 * 校验对象是否为有效的 CoordSetParams
 * @param value 要校验的值
 * @returns 是否为有效的 CoordSetParams
 */
export function isCoordSetParams(value: unknown): value is CoordSetParams {
  if (value === null || value === undefined) {
    return false;
  }
  const params = value as Record<string, unknown>;
  if (!('rootObj' in params)) {
    return false;
  }
  if (!('editCoord' in params)) {
    return false;
  }
  if (!('newValue' in params)) {
    return false;
  }
  return true;
}

/**
 * 获取set操作的逆操作参数（用于撤销set操作）
 * @param param set参数
 * @param oldValue 被覆盖的旧值
 * @returns 逆操作参数
 */
export function getCoordSetReverseParams(
  param: CoordSetParams,
  oldValue: unknown,
): CoordSetParams {
  return {
    rootObj: param.rootObj,
    editCoord: param.editCoord,
    newValue: oldValue,
  };
}
/**
 * 获取数组splice操作的逆操作参数（用于撤销splice操作）
 * @param targetArrayOriginLength 数组被splice前的原始长度
 * @param param splice参数
 * @param deletedItems 被删除的项
 * @returns 逆操作参数
 */
export function getCoordSpliceReverseParams(
  targetArrayOriginLength: number,
  param: CoordSpliceParams,
  deletedItems: unknown[],
): CoordSpliceParams {
  let recalStart = param.start;
  if(recalStart < 0) {
    // 将负数索引转换为正数索引
    recalStart = targetArrayOriginLength + recalStart;
    if(recalStart < 0) {
      recalStart = 0;
    }
  }

  return {
    rootObj: param.rootObj,
    editCoord: param.editCoord,
    start: recalStart,
    deleteCount: param.items.length,
    items: deletedItems,
  };
}

/**
 * 执行数组的splice操作，并返回逆操作参数（用于撤销splice操作）
 * @param param splice参数
 * @returns 包含被删除项和逆操作参数的结果对象
 */
export function coordSplice<T = unknown>(
  param: CoordSpliceParams
): CoordSpliceResult<T> {
  try {
    const { rootObj, editCoord, start, deleteCount, items } = param;
    const target = get(rootObj, editCoord);

    if (target === undefined) {
      console.warn(`coordSplice: 路径 "${editCoord}" 未匹配到任何对象`);
      return {
        deletedItems: [],
        reverseParams: null,
      };
    }

    if (!Array.isArray(target)) {
      console.error(`coordSplice: 路径 "${editCoord}" 匹配到非数组类型，类型为 ${typeof target}`);
      return {
        deletedItems: [],
        reverseParams: null,
      };
    }

    const targetArray = target as T[];
    const targetArrayOriginLength = targetArray.length;
    const deletedItems = targetArray.splice(start, deleteCount, ...(items as T[]));

    return {
      deletedItems: deletedItems as T[],
      // 逆操作参数：将删除的项插入到原位置
      reverseParams: getCoordSpliceReverseParams(targetArrayOriginLength, param, deletedItems)
    };
  } catch (error) {
    console.error(`coordSplice 执行异常：`, error);
    return {
      deletedItems: [],
      reverseParams: null,
    };
  }
}

export function coordSet<T = unknown>(
  param: CoordSetParams
): CoordSetResult<T> {
  try {
    const { rootObj, editCoord, newValue } = param;
    const oldValue = get(rootObj, editCoord);

    if (oldValue === undefined) {
      console.warn(`coordSet: 路径 "${editCoord}" 未匹配到任何节点`);
      return {
        oldValue: undefined as T,
        reverseParams: null,
      };
    }

    set(rootObj, editCoord, newValue);

    return {
      oldValue: oldValue as T,
      reverseParams: getCoordSetReverseParams(param, oldValue),
    };
  } catch (error) {
    console.error(`coordSet 执行失败：`, error);
    return {
      oldValue: undefined as T,
      reverseParams: null,
    };
  }
}
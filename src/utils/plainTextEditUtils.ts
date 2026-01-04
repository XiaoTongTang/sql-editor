import type { Update as UpdateAST } from 'node-sql-parser'

const sandboxAst: UpdateAST = {
  db: null,
  type: 'update',
  table: [
    {
      db: null,
      table: 'sql_editor_sandbox',
      as: null,
    },
  ],
  set: [
    {
      column: 'a',
      value: {
        type: 'number',
        value: 1,
      },
      table: null,
    },
  ],
  where: {
    type: 'binary_expr',
    operator: '=',
    left: {
      type: 'column_ref',
      table: null,
      column: 'id',
      collate: null,
    },
    right: {
      type: 'number',
      value: 1,
    },
  },
}
export const getSandboxAst = () => ({ ...sandboxAst })
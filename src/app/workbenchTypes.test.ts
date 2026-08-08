import { describe, expect, it } from 'vitest'
import { workbenchStages } from './workbenchTypes'

describe('workbench stages', () => {
  it('exposes the four MVP workflow stages in order', () => {
    expect(workbenchStages).toEqual(['数据集', '模型', '训练', '结果'])
  })
})

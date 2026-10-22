import { expect, test } from '@playwright/test'

test.describe('工作台关键流程', () => {
  test('可以选择数据集、进入实验流程、切换模型并开始训练', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /机器学习实验工作台/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: '数据集', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '确认数据集并进入实验流程' }).click()
    await expect(page.getByRole('complementary', { name: '实验配置' })).toBeVisible()
    await expect(page.getByRole('main', { name: '训练画布' })).toBeVisible()
    await page.getByRole('button', { name: '更换数据集' }).click()
    await page.getByLabel('内置数据集').selectOption('xor')
    await page.getByRole('button', { name: '确认数据集并进入实验流程' }).click()
    await page.getByRole('combobox', { name: '具体模型' }).selectOption('linear-svm')
    await page.getByRole('button', { name: '开始训练' }).click()
    await expect(page.locator('.single-page-status')).toHaveText('训练完成')
  })

  test('训练后可查看模型解释与损失曲线', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '确认数据集并进入实验流程' }).click()
    await page.getByRole('combobox', { name: '具体模型' }).selectOption('logistic-regression')
    await page.getByRole('button', { name: '开始训练' }).click()
    await expect(page.locator('.single-page-status')).toHaveText('训练完成')
    await expect(page.getByRole('heading', { name: /逻辑回归/ }).first()).toBeVisible()
    await expect(page.getByRole('img', { name: '训练损失曲线' }).first()).toBeVisible()
    await page.getByRole('combobox', { name: '训练步骤' }).selectOption('1')
    await expect(page.getByRole('combobox', { name: '训练步骤' })).toHaveValue('1')
    await expect(page.getByLabel('当前快照')).toContainText('第 1 步 · 损失')
  })

  test('暂停确认刷新快照、单步前进一单位，停止记录不显示最终结果', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: '具体模型' }).selectOption('logistic-regression')
    await page.getByRole('button', { name: '确认数据集并进入实验流程' }).click()
    await page.getByRole('spinbutton', { name: '迭代次数' }).fill('5000')
    await page.getByRole('button', { name: '开始训练', exact: true }).click()

    const currentIteration = async () => {
      const text = await page.getByLabel('实时训练反馈').locator('strong').innerText()
      return Number(text.match(/(\d+)\s*\/\s*5000/)?.[1] ?? 0)
    }
    await expect.poll(currentIteration).toBeGreaterThan(0)
    await page.getByRole('button', { name: '暂停', exact: true }).click()
    await expect(page.locator('.single-page-status')).toHaveText('训练已暂停')
    const pausedAt = await currentIteration()
    await expect.poll(currentIteration, { timeout: 1200 }).toBe(pausedAt)

    await page.getByRole('button', { name: '单步', exact: true }).click()
    await expect.poll(currentIteration).toBe(pausedAt + 1)
    await expect(page.locator('.single-page-status')).toHaveText('训练已暂停')
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await expect.poll(currentIteration).toBeGreaterThan(pausedAt + 1)
    await page.getByRole('button', { name: '停止', exact: true }).click()
    await expect(page.locator('.single-page-status')).toHaveText('训练已停止')

    await page.getByRole('tab', { name: '历史记录' }).click()
    const detail = page.getByRole('complementary', { name: '实验详情' })
    await expect(detail).toContainText('训练已停止')
    await expect(detail).toContainText('未生成最终模型或指标')
    await expect(detail.getByRole('region', { name: '当前结果' })).toHaveCount(0)
  })

  test('手机宽度下所有高维特征可在样本表格内部滚动查看', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.getByRole('combobox', { name: '具体模型' }).selectOption('visual-cnn')
    await page.getByLabel('内置数据集').selectOption('digits')

    const tableWrap = page.locator('.dataset-table-wrap')
    await expect(page.locator('.dataset-preview-grid > div:nth-child(2) li')).toHaveCount(64)
    const dimensions = await tableWrap.evaluate(element => {
      const wrapper = element as HTMLElement
      const table = wrapper.querySelector('table')!
      wrapper.scrollLeft = wrapper.scrollWidth
      return { clientWidth: wrapper.clientWidth, scrollWidth: wrapper.scrollWidth, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, lastColumnRight: table.querySelector('thead th:last-child')!.getBoundingClientRect().right, wrapperRight: wrapper.getBoundingClientRect().right }
    })
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth)
    expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
    expect(dimensions.lastColumnRight).toBeLessThanOrEqual(dimensions.wrapperRight + 1)
  })

  test('可切换到历史记录页', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: '历史记录' }).click()
    await expect(page.getByRole('heading', { name: /历史训练记录/ })).toBeVisible()
  })

  test('历史查看旧模型不会覆盖当前模型的指标和解释', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '确认数据集并进入实验流程' }).click()
    const model = page.getByRole('combobox', { name: '具体模型' })
    await model.selectOption('knn')
    await page.getByRole('button', { name: '开始训练', exact: true }).click()
    await expect(page.locator('.single-page-status')).toHaveText('训练完成')
    await model.selectOption('logistic-regression')
    await page.getByRole('button', { name: '开始训练', exact: true }).click()
    await expect(page.locator('.single-page-status')).toHaveText('训练完成')
    const currentMetrics = await page.getByRole('region', { name: '当前结果' }).innerText()
    await page.getByRole('tab', { name: '历史记录' }).click()
    await page.locator('.result-row').filter({ hasText: 'KNN' }).getByRole('button', { name: '查看详情' }).click()
    await expect(page.getByRole('complementary', { name: '实验详情' }).getByRole('heading', { name: /KNN/ })).toBeVisible()
    await page.getByRole('tab', { name: '实验流程' }).click()
    await expect(model).toHaveValue('logistic-regression')
    await expect(page.locator('.model-explanation-panel').getByRole('heading', { name: '逻辑回归', exact: true })).toBeVisible()
    expect(await page.getByRole('region', { name: '当前结果' }).innerText()).toBe(currentMetrics)
  })

  test('确认数据前不能进入训练，完成后不能继续或伪造单步', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('tab', { name: '实验流程' })).toBeDisabled()
    await page.getByLabel('内置数据集').selectOption('xor')
    await page.getByRole('button', { name: '确认数据集并进入实验流程' }).click()
    await expect(page.getByRole('region', { name: '当前数据集' })).toContainText('XOR')
    await expect(page.getByRole('button', { name: '开始训练', exact: true })).toBeDisabled()
    await page.getByRole('combobox', { name: '具体模型' }).selectOption('knn')
    await page.getByRole('button', { name: '开始训练', exact: true }).click()
    await expect(page.locator('.single-page-status')).toHaveText('训练完成')
    for (const name of ['暂停', '单步', '继续', '停止']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeDisabled()
    }
    await expect(page.getByText('暂无训练过程数据')).toHaveCount(0)
    await expect(page.getByText('第 0 次迭代', { exact: false })).toHaveCount(0)
  })

  test('非法 CSV 阻止确认，合法 CSV 在往返页面后保留预览', async ({ page }) => {
    await page.goto('/')
    const upload = page.getByLabel('上传 CSV')
    const confirm = page.getByRole('button', { name: '确认数据集并进入实验流程' })
    await upload.setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('x,y,label\nwrong,,') })
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(confirm).toBeDisabled()
    await page.getByRole('tab', { name: '历史记录' }).click()
    await page.getByRole('tab', { name: '数据集选择' }).click()
    await expect(confirm).toBeDisabled()
    await expect(page.getByRole('alert')).toBeVisible()
    await upload.setInputFiles({ name: 'good.csv', mimeType: 'text/csv', buffer: Buffer.from('x,y,label\n1.1234567,2,A\n3,4,B') })
    await expect(page.getByLabel('内置数据集')).toHaveValue('csv')
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(page.getByRole('region', { name: '当前数据集' })).toContainText('CSV 数据集')
    await page.getByRole('button', { name: '更换数据集' }).click()
    await expect(page.getByLabel('内置数据集')).toHaveValue('csv')
    await expect(page.getByRole('cell', { name: '1.1235', exact: true })).toHaveAttribute('title', '1.1234567')
    await expect(page.getByRole('tab', { name: '实验流程' })).toBeEnabled()
  })

  test('窄屏仍可编辑 CNN，网络图保持局部滚动', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto('/')
    await page.getByLabel('内置数据集').selectOption('digits')
    await page.getByRole('button', { name: '确认数据集并进入实验流程' }).click()
    await page.getByRole('combobox', { name: '具体模型' }).selectOption('visual-cnn')
    await expect(page.getByRole('region', { name: '网络结构搭建器' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await page.getByRole('spinbutton', { name: '卷积滤波器数' }).fill('33')
    await expect(page.getByRole('button', { name: '开始训练', exact: true })).toBeDisabled()
    await page.getByRole('spinbutton', { name: '卷积滤波器数' }).fill('8')
    await expect(page.getByRole('button', { name: '开始训练', exact: true })).toBeEnabled()
  })

  for (const width of [375, 768, 1366, 1920]) {
    test(`${width}px 下数据与训练结果不溢出或截断`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await expect(page.getByRole('heading', { name: '数据集', exact: true })).toBeVisible()
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      expect(await overflow()).toBe(false)
      await page.getByRole('button', { name: '确认数据集并进入实验流程' }).click()
      await page.getByRole('combobox', { name: '具体模型' }).selectOption('knn')
      await page.getByRole('button', { name: '开始训练', exact: true }).click()
      await expect(page.locator('.single-page-status')).toHaveText('训练完成')
      expect(await overflow()).toBe(false)
      const clippedCards = await page.locator('.current-result, .model-explanation-card').evaluateAll((cards) => cards.filter((card) => card.scrollHeight > card.clientHeight + 2 || card.scrollWidth > card.clientWidth + 2).length)
      expect(clippedCards).toBe(0)
      await page.getByRole('heading', { name: '当前结果' }).scrollIntoViewIfNeeded()
      await expect(page.getByRole('heading', { name: '当前结果' })).toBeVisible()
    })
  }
})

import { expect, test } from '@playwright/test'

test.describe('工作台关键流程', () => {
  test('可在单页选择数据集、切换模型并开始训练', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /机器学习实验工作台/ })).toBeVisible()
    await expect(page.getByRole('complementary', { name: '实验配置' })).toBeVisible()
    await expect(page.getByRole('main', { name: '训练画布' })).toBeVisible()
    await page.getByLabel('内置数据集').selectOption('xor')
    await page.getByRole('combobox', { name: '训练模型' }).selectOption('linear-svm')
    await page.getByRole('button', { name: '开始训练' }).click()
    await expect(page.getByRole('status')).toContainText(/训练(中|完成|失败|已取消)/)
  })

  test('训练后可查看模型解释与损失曲线', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: '训练模型' }).selectOption('logistic-regression')
    await page.getByRole('button', { name: '开始训练' }).click()
    await expect(page.getByRole('heading', { name: /逻辑回归/ })).toBeVisible()
    await expect(page.getByText(/训练损失曲线/).first()).toBeVisible()
  })
})

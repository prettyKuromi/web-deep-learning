import { expect, test } from '@playwright/test'

test.describe('工作台关键流程', () => {
  test('可选择数据集、切换模型并开始训练', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /机器学习实验工作台/ })).toBeVisible()

    const datasetSelect = page.getByLabel('内置数据集')
    await expect(datasetSelect).toBeVisible()
    await datasetSelect.selectOption('xor')

    const svm = page.getByRole('radio', { name: /线性.*SVM/ })
    await svm.check()
    await expect(svm).toBeChecked()

    const trainButton = page.getByRole('button', { name: /开始训练/ }).first()
    await trainButton.click()
    await expect(page.getByRole('status')).toContainText(/训练(中|完成|失败)/)
  })

  test('训练后可查看实验结果', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /开始训练/ }).first().click()
    await expect(page.getByText('实验结果')).toBeVisible()
    await expect(page.getByText(/准确率/).first()).toBeVisible()
  })
})

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ActionMenu from '@/components/ActionMenu'

afterEach(cleanup)

describe('row action menu keyboard access', () => {
  const actions = () => [{ label: 'Preview', onSelect: vi.fn() }, { label: 'Disabled', disabled: true, onSelect: vi.fn() }, { label: 'Edit', onSelect: vi.fn() }]

  it('supports arrow navigation and Escape restores the trigger focus', () => {
    render(<ActionMenu label="Actions for course" actions={actions()} />)
    const trigger = screen.getByRole('button', { name: 'Actions for course' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: 'Preview' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('opens the last available action with ArrowUp', () => {
    render(<ActionMenu label="Actions for course" actions={actions()} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' })
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
  })

  it('closes the menu after selecting an action', () => {
    const options = actions()
    render(<ActionMenu label="Actions for course" actions={options} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    expect(options[2].onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('does not show an empty menu trigger', () => {
    render(<ActionMenu label="No actions" actions={[]} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

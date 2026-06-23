// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsModal } from './DeckLayout'
import { ThemeProvider } from '../contexts/ThemeContext'
import { DEFAULT_SETTINGS } from '@shared/types'

vi.mock('../api/settings', () => ({
  settingsApi: {
    getDeck: vi.fn(),
    updateDeck: vi.fn(),
  },
}))

import { settingsApi } from '../api/settings'

function renderModal(onClose = vi.fn()) {
  return render(
    <ThemeProvider>
      <SettingsModal deckId="deck1" onClose={onClose} />
    </ThemeProvider>
  )
}

beforeEach(() => {
  vi.mocked(settingsApi.getDeck).mockResolvedValue({ ...DEFAULT_SETTINGS, batchSize: 15 })
  vi.mocked(settingsApi.updateDeck).mockResolvedValue({ ...DEFAULT_SETTINGS })
})

afterEach(cleanup)

describe('SettingsModal — batch size input', () => {
  it('allows typing an intermediate value without clamping', async () => {
    const user = userEvent.setup()
    renderModal()

    const input: HTMLInputElement = await screen.findByRole('spinbutton')

    await user.clear(input)
    await user.type(input, '1')

    // "1" is below the min of 3, but must remain "1" while the user is still typing
    expect(input.value).toBe('1')

    await user.type(input, '0')
    expect(input.value).toBe('10')
  })

  it('clamps to min on blur when value is too low', async () => {
    const user = userEvent.setup()
    renderModal()

    const input: HTMLInputElement = await screen.findByRole('spinbutton')

    await user.clear(input)
    await user.type(input, '1')
    await user.tab() // triggers blur

    expect(input.value).toBe('3')
  })

  it('clamps to max on blur when value is too high', async () => {
    const user = userEvent.setup()
    renderModal()

    const input: HTMLInputElement = await screen.findByRole('spinbutton')

    await user.clear(input)
    await user.type(input, '99')
    await user.tab()

    expect(input.value).toBe('50')
  })

  it('saves the committed value', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal(onClose)

    const input: HTMLInputElement = await screen.findByRole('spinbutton')

    await user.clear(input)
    await user.type(input, '10')
    await user.tab()

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(settingsApi.updateDeck).toHaveBeenCalledWith(
        'deck1',
        expect.objectContaining({ batchSize: 10 })
      )
    })
    expect(onClose).toHaveBeenCalled()
  })
})

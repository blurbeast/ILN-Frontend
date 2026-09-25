import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rpc, TransactionBuilder } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from '@/constants';
import {
  castVote,
  executeProposal,
  createProposal,
  type CreateProposalPayload,
} from '@/utils/governance';

const SIGNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

describe('governance write paths – signTx callback invocation (Issue #10)', () => {
  let prepareSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    prepareSpy = vi
      .spyOn(rpc.Server.prototype, 'prepareTransaction')
      .mockImplementation(async (tx) => tx);
  });

  afterEach(() => {
    prepareSpy.mockRestore();
    vi.useRealTimers();
  });

  it('castVote invokes signTx callback with valid Soroban transaction XDR and returns deterministic hash', async () => {
    vi.useFakeTimers();
    const signTx = vi.fn(async (xdr: string) => xdr);

    const votePromise = castVote(1, 'For', SIGNER, signTx);
    await vi.runAllTimersAsync();
    const hash = await votePromise;

    // 1. Assert signTx callback was invoked exactly once
    expect(signTx).toHaveBeenCalledTimes(1);

    // 2. Assert argument matches Soroban transaction XDR shape (valid base64 string)
    const passedXdr = signTx.mock.calls[0][0];
    expect(typeof passedXdr).toBe('string');
    expect(passedXdr.length).toBeGreaterThan(50);
    expect(passedXdr).toMatch(/^[A-Za-z0-9+/=]+$/);

    // 3. Assert the passed XDR is a parseable Stellar transaction envelope
    const parsedTx = TransactionBuilder.fromXDR(passedXdr, NETWORK_PASSPHRASE);
    expect(parsedTx).toBeDefined();

    // 4. Assert returned hash is deterministic (64 hex chars matching SHA-256 transaction hash), NOT a random string
    const expectedDeterministicHash = parsedTx.hash().toString('hex');
    expect(hash).toBe(expectedDeterministicHash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('executeProposal invokes signTx callback with valid Soroban transaction XDR and returns deterministic hash', async () => {
    vi.useFakeTimers();
    const signTx = vi.fn(async (xdr: string) => xdr);

    const execPromise = executeProposal(1, SIGNER, signTx);
    await vi.runAllTimersAsync();
    const hash = await execPromise;

    expect(signTx).toHaveBeenCalledTimes(1);

    const passedXdr = signTx.mock.calls[0][0];
    expect(typeof passedXdr).toBe('string');
    expect(passedXdr.length).toBeGreaterThan(50);
    expect(passedXdr).toMatch(/^[A-Za-z0-9+/=]+$/);

    const parsedTx = TransactionBuilder.fromXDR(passedXdr, NETWORK_PASSPHRASE);
    const expectedDeterministicHash = parsedTx.hash().toString('hex');
    expect(hash).toBe(expectedDeterministicHash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('createProposal invokes signTx callback with valid Soroban transaction XDR and returns deterministic hash', async () => {
    vi.useFakeTimers();
    const signTx = vi.fn(async (xdr: string) => xdr);

    const payload: CreateProposalPayload = {
      title: 'Update Fee Rate to 0.4%',
      description: 'Proposal to update fee rate parameter',
      formType: 'FeeRate',
      newValueBps: 40,
    };

    const createPromise = createProposal(payload, SIGNER, signTx);
    await vi.runAllTimersAsync();
    const result = await createPromise;

    expect(signTx).toHaveBeenCalledTimes(1);

    const passedXdr = signTx.mock.calls[0][0];
    expect(typeof passedXdr).toBe('string');
    expect(passedXdr.length).toBeGreaterThan(50);
    expect(passedXdr).toMatch(/^[A-Za-z0-9+/=]+$/);

    const parsedTx = TransactionBuilder.fromXDR(passedXdr, NETWORK_PASSPHRASE);
    const expectedDeterministicHash = parsedTx.hash().toString('hex');
    expect(result.txHash).toBe(expectedDeterministicHash);
    expect(result.txHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.proposalId).toBeGreaterThan(0);
  });
});

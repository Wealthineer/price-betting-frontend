'use client';

import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from '@solana/web3.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useTransactionToast } from '../ui/ui-layout';
import { AnchorProvider, BN, Program, Wallet, web3 } from "@coral-xyz/anchor";
import { BET_PROGRAM, IDL, PriceBetting, TREASURY } from '@/anchor-programs/price-betting';
import { PullFeed } from "@switchboard-xyz/on-demand";

export function useGetBalance({ address }: { address: PublicKey }) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address }],
    queryFn: () => connection.getBalance(address),
  });
}

export function useGetSignatures({ address }: { address: PublicKey }) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ['get-signatures', { endpoint: connection.rpcEndpoint, address }],
    queryFn: () => connection.getSignaturesForAddress(address),
  });
}

export function useGetTokenAccounts({ address }: { address: PublicKey }) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: [
      'get-token-accounts',
      { endpoint: connection.rpcEndpoint, address },
    ],
    queryFn: async () => {
      const [tokenAccounts, token2022Accounts] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_PROGRAM_ID,
        }),
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_2022_PROGRAM_ID,
        }),
      ]);
      return [...tokenAccounts.value, ...token2022Accounts.value];
    },
  });
}

export function useCreateBet() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const wallet = useWallet();
  const transactionToast = useTransactionToast();
  const client = useQueryClient();

  const provider = new AnchorProvider(connection, anchorWallet!, {});
  const program = new Program<PriceBetting>(IDL, provider);

  return useMutation({
    mutationKey: ['create-bet', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (input: {betSeed: number, openUntil: number, resolveDate: number, pricePrediction: number, wagerAmount: number, directionCreator: boolean, switchboardFeed: string}) => {

      if (!anchorWallet || !wallet) {
        throw new Error("Wallet not connected");
      }

      const bet  = PublicKey.findProgramAddressSync([Buffer.from("bet"), BET_PROGRAM.toBuffer(), anchorWallet?.publicKey.toBuffer(), new BN(input.betSeed).toArrayLike(Buffer, "le", 8)], program.programId)[0];
      console.log("Bet", bet.toBase58());
      const bettingPool = PublicKey.findProgramAddressSync([Buffer.from("betting_pool"), bet.toBuffer()], program.programId)[0];
      console.log("Betting Pool", bettingPool.toBase58());


      console.log("input.pricePrediction ", input.pricePrediction)

      //@ts-ignore
      const tx = await program.methods.createBet(
        new BN(input.betSeed), 
        new BN(input.openUntil), 
        new BN(input.resolveDate), 
        new BN(input.pricePrediction), 
        true, 
        new PublicKey(input.switchboardFeed), 
        new BN(input.wagerAmount))
        .accountsPartial({
        betCreator: anchorWallet?.publicKey,
        betProgram: BET_PROGRAM,
        bet: bet,
        bettingPool: bettingPool,
        systemProgram: SystemProgram.programId,
      })
      .transaction()

      const signature = await wallet.sendTransaction(tx, connection);

      const latestBlockhash = await connection.getLatestBlockhash();

      await connection.confirmTransaction(
        { signature, ...latestBlockhash },
        'confirmed'
      );
      return {signature, bet, bettingPool};
    },
    onSuccess: ({signature, bet, bettingPool}) => {
      transactionToast(signature);
      console.log("Bet", bet.toBase58());
      console.log("Betting Pool", bettingPool.toBase58());
      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            'get-balance',
            { endpoint: connection.rpcEndpoint },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'get-signatures',
            { endpoint: connection.rpcEndpoint },
          ],
        }),
      ]);
    },
  });
}

export function useCancelBet() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const wallet = useWallet();
  const transactionToast = useTransactionToast();
  const client = useQueryClient();

  const provider = new AnchorProvider(connection, anchorWallet!, {});
  const program = new Program<PriceBetting>(IDL, provider);

  return useMutation({
    mutationKey: ['cancel-bet', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (betSeed: BN) => {

      if (!anchorWallet || !wallet) {
        throw new Error("Wallet not connected");
      }

      const bet  = PublicKey.findProgramAddressSync([Buffer.from("bet"), BET_PROGRAM.toBuffer(), anchorWallet?.publicKey.toBuffer(), betSeed.toArrayLike(Buffer, "le", 8)], program.programId)[0];
      console.log("Bet", bet.toBase58());
      const bettingPool = PublicKey.findProgramAddressSync([Buffer.from("betting_pool"), bet.toBuffer()], program.programId)[0];
      console.log("Betting Pool", bettingPool.toBase58());

 
      //@ts-ignore
      const tx = await program.methods.cancelBet(betSeed).accountsPartial({
        betCreator: wallet.publicKey,
        betProgram: BET_PROGRAM,
        bet: bet,
        bettingPool: bettingPool,
        systemProgram: SystemProgram.programId,
      })
      .transaction()

      const latestBlockhash = await connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey!,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: tx.instructions,
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(messageV0);

      const signature = await wallet.sendTransaction(versionedTx, connection);


      await connection.confirmTransaction(
        { signature, ...latestBlockhash },
        'confirmed'
      );
      return {signature, bet, bettingPool};
    },
    onSuccess: ({signature, bet, bettingPool}) => {
      transactionToast(signature);
      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            'get-balance',
            { endpoint: connection.rpcEndpoint },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'get-signatures',
            { endpoint: connection.rpcEndpoint },
          ],
        }),
      ]);
    },
  });
}

export function useAcceptBet() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const wallet = useWallet();
  const transactionToast = useTransactionToast();
  const client = useQueryClient();

  const provider = new AnchorProvider(connection, anchorWallet!, {});
  const program = new Program<PriceBetting>(IDL, provider);

  return useMutation({
    mutationKey: ['accept-bet', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (input: {betSeed: BN, betCreator: PublicKey}) => {

      if (!anchorWallet || !wallet) {
        throw new Error("Wallet not connected");
      }
      console.log("input ", input)

      const bet  = PublicKey.findProgramAddressSync([Buffer.from("bet"), BET_PROGRAM.toBuffer(), input.betCreator.toBuffer(), input.betSeed.toArrayLike(Buffer, "le", 8)], program.programId)[0];
      console.log("Bet", bet.toBase58());
      const bettingPool = PublicKey.findProgramAddressSync([Buffer.from("betting_pool"), bet.toBuffer()], program.programId)[0];
      console.log("Betting Pool", bettingPool.toBase58());

      //@ts-ignore
      const tx = await program.methods.acceptBet(input.betSeed).accountsPartial({
        betTaker: wallet.publicKey,
        betCreator: input.betCreator,
        betProgram: BET_PROGRAM,
        bet: bet,
        bettingPool: bettingPool,
        treasury: TREASURY,
        systemProgram: SystemProgram.programId,
      })
      .transaction()

      const latestBlockhash = await connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey!,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: tx.instructions,
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(messageV0);

      const signature = await wallet.sendTransaction(versionedTx, connection);


      await connection.confirmTransaction(
        { signature, ...latestBlockhash },
        'confirmed'
      );
      return {signature, bet, bettingPool};
    },
    onSuccess: ({signature, bet, bettingPool}) => {
      transactionToast(signature);
      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            'get-balance',
            { endpoint: connection.rpcEndpoint },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'get-signatures',
            { endpoint: connection.rpcEndpoint },
          ],
        }),
      ]);
    },
  });
}

export function useResolveBet() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const wallet = useWallet();
  const transactionToast = useTransactionToast();
  const client = useQueryClient();

  const provider = new AnchorProvider(connection, anchorWallet!, {});
  const program = new Program<PriceBetting>(IDL, provider);

  return useMutation({
    mutationKey: ['resolve-bet', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (input: {betSeed: BN, betCreator: PublicKey, resolverFeed: PublicKey}) => {

      if (!anchorWallet || !wallet) {
        throw new Error("Wallet not connected");
      }
      console.log("input ", input)

      const bet  = PublicKey.findProgramAddressSync([Buffer.from("bet"), BET_PROGRAM.toBuffer(), input.betCreator.toBuffer(), input.betSeed.toArrayLike(Buffer, "le", 8)], program.programId)[0];
      console.log("Bet", bet.toBase58());
      const bettingPool = PublicKey.findProgramAddressSync([Buffer.from("betting_pool"), bet.toBuffer()], program.programId)[0];
      console.log("Betting Pool", bettingPool.toBase58());


      const switchboardProgramIdDevnet = new PublicKey("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2");

      const idl = (await Program.fetchIdl(
        switchboardProgramIdDevnet,
        provider
      ))!;

      const switchboardProgram = new Program(idl, provider);

      const feedAccount = new PullFeed(switchboardProgram, input.resolverFeed);
      const [pullIx] = await feedAccount.fetchUpdateIx();
  
      //@ts-ignore
      const resolveIx = await program.methods.resolveBetWihtoutUpdate(input.betSeed).accountsPartial({
          resolver: wallet.publicKey,
          betCreator: input.betCreator,
          betProgram: BET_PROGRAM,
          bet: bet,
          resolverFeed: input.resolverFeed,
        }).instruction();

      const latestBlockhash = await connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey!,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [pullIx, resolveIx],
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(messageV0);

      const signature = await wallet.sendTransaction(versionedTx, connection);


      await connection.confirmTransaction(
        { signature, ...latestBlockhash },
        'confirmed'
      );
      return {signature, bet, bettingPool};
    },
    onSuccess: ({signature, bet, bettingPool}) => {
      transactionToast(signature);
      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            'get-balance',
            { endpoint: connection.rpcEndpoint },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'get-signatures',
            { endpoint: connection.rpcEndpoint },
          ],
        }),
      ]);
    },
  });
}

export function useClaimBet() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const wallet = useWallet();
  const transactionToast = useTransactionToast();
  const client = useQueryClient();

  const provider = new AnchorProvider(connection, anchorWallet!, {});
  const program = new Program<PriceBetting>(IDL, provider);

  return useMutation({
    mutationKey: ['claim-bet', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (input: {betSeed: BN, betCreator: PublicKey}) => {

      if (!anchorWallet || !wallet) {
        throw new Error("Wallet not connected");
      }
      console.log("input ", input)

      const bet  = PublicKey.findProgramAddressSync([Buffer.from("bet"), BET_PROGRAM.toBuffer(), input.betCreator.toBuffer(), input.betSeed.toArrayLike(Buffer, "le", 8)], program.programId)[0];
      console.log("Bet", bet.toBase58());
      const bettingPool = PublicKey.findProgramAddressSync([Buffer.from("betting_pool"), bet.toBuffer()], program.programId)[0];
      console.log("Betting Pool", bettingPool.toBase58());

      //@ts-ignore
      const tx = await program.methods.claimBet(input.betSeed).accountsPartial({
        claimer: wallet.publicKey, 
        betCreator: input.betCreator,
        betProgram: BET_PROGRAM,
        bet: bet,
        bettingPool: bettingPool,
        systemProgram: SystemProgram.programId,
      })
      .transaction()

      const latestBlockhash = await connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey!,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: tx.instructions,
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(messageV0);

      const signature = await wallet.sendTransaction(versionedTx, connection);


      await connection.confirmTransaction(
        { signature, ...latestBlockhash },
        'confirmed'
      );
      return {signature, bet, bettingPool};
    },
    onSuccess: ({signature, bet, bettingPool}) => {
      transactionToast(signature);
      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            'get-balance',
            { endpoint: connection.rpcEndpoint },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'get-signatures',
            { endpoint: connection.rpcEndpoint },
          ],
        }),
      ]);
    },
  });
}

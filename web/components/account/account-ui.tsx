'use client';

import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { IconRefresh } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { AppModal, ellipsify } from '../ui/ui-layout';
import { useCluster } from '../cluster/cluster-data-access';
import { ExplorerLink } from '../cluster/cluster-ui';
import {
  useAcceptBet,
  useCancelBet,
  useClaimBet,
  useCreateBet,
  useGetBalance,
  useGetSignatures,
  useGetTokenAccounts,
  useResolveBet,
} from './account-data-access';
import { Field, Label } from '../tailwindui-catalyst/fieldset';
import { Input } from '../tailwindui-catalyst/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../tailwindui-catalyst/table'
import { Select } from '../tailwindui-catalyst/select';
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import { BET_PROGRAM, IDL, PriceBetting } from '@/anchor-programs/price-betting';

export function AccountBalanceCheck({ address }: { address: PublicKey }) {
  const { cluster } = useCluster();
  const query = useGetBalance({ address });

  if (query.isLoading) {
    return null;
  }
  if (query.isError || !query.data) {
    return (
      <div className="alert alert-warning text-warning-content/80 rounded-none flex justify-center">
        <span>
          You are connected to <strong>{cluster.name}</strong> but your account
          is not found on this cluster.
        </span>
      </div>
    );
  }
  return null;
}

export function AccountButtons() {
  const wallet = useWallet();
  const { cluster } = useCluster();
  const [showCreateBetModal, setShowCreateBetModal] = useState(false);
  const [showCancelBetModal, setShowCancelBetModal] = useState(false);
  const [showAcceptBetModal, setShowAcceptBetModal] = useState(false);
  const [showResolveBetModal, setShowResolveBetModal] = useState(false);
  const [showClaimBetModal, setShowClaimBetModal] = useState(false);

  return (
    <div>
      <ModalCreateBet
        show={showCreateBetModal}
        hide={() => setShowCreateBetModal(false)}
      />

      <ModalCancelBet
        show={showCancelBetModal}
        hide={() => setShowCancelBetModal(false)}
      />

      <ModalAcceptBet
        show={showAcceptBetModal}
        hide={() => setShowAcceptBetModal(false)}
      />

      <ModalResolveBet
        show={showResolveBetModal}
        hide={() => setShowResolveBetModal(false)}
      />

      <ModalClaimBet
        show={showClaimBetModal}
        hide={() => setShowClaimBetModal(false)}
      />

      <div className="space-x-2">
        <button
          className="btn btn-xs lg:btn-md btn-outline"
          onClick={() => setShowCreateBetModal(true)}
        >
          Create Bet
        </button>
        <button
          className="btn btn-xs lg:btn-md btn-outline"
          onClick={() => setShowCancelBetModal(true)}
        >
          Cancel Bet
        </button>
        <button
          className="btn btn-xs lg:btn-md btn-outline"
          onClick={() => setShowAcceptBetModal(true)}
        >
          Accept Bet
        </button>
        <button
          className="btn btn-xs lg:btn-md btn-outline"
          onClick={() => setShowResolveBetModal(true)}
        >
          Resolve Bet
        </button>
        <button
          className="btn btn-xs lg:btn-md btn-outline"
          onClick={() => setShowClaimBetModal(true)}
        >
          Claim Bet
        </button>
      </div>
    </div>
  );
}

export function AccountTokens({ address }: { address: PublicKey }) {
  const [showAll, setShowAll] = useState(false);
  const query = useGetTokenAccounts({ address });
  const client = useQueryClient();
  const items = useMemo(() => {
    if (showAll) return query.data;
    return query.data?.slice(0, 5);
  }, [query.data, showAll]);

  return (
    <div className="space-y-2">
      <div className="justify-between">
        <div className="flex justify-between">
          <h2 className="text-2xl font-bold">Token Accounts</h2>
          <div className="space-x-2">
            {query.isLoading ? (
              <span className="loading loading-spinner"></span>
            ) : (
              <button
                className="btn btn-sm btn-outline"
                onClick={async () => {
                  await query.refetch();
                  await client.invalidateQueries({
                    queryKey: ['getTokenAccountBalance'],
                  });
                }}
              >
                <IconRefresh size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      {query.isError && (
        <pre className="alert alert-error">
          Error: {query.error?.message.toString()}
        </pre>
      )}
      {query.isSuccess && (
        <div>
          {query.data.length === 0 ? (
            <div>No token accounts found.</div>
          ) : (
            <table className="table border-4 rounded-lg border-separate border-base-300">
              <thead>
                <tr>
                  <th>Public Key</th>
                  <th>Mint</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {items?.map(({ account, pubkey }) => (
                  <tr key={pubkey.toString()}>
                    <td>
                      <div className="flex space-x-2">
                        <span className="font-mono">
                          <ExplorerLink
                            label={ellipsify(pubkey.toString())}
                            path={`account/${pubkey.toString()}`}
                          />
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <span className="font-mono">
                          <ExplorerLink
                            label={ellipsify(account.data.parsed.info.mint)}
                            path={`account/${account.data.parsed.info.mint.toString()}`}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="text-right">
                      <span className="font-mono">
                        {account.data.parsed.info.tokenAmount.uiAmount}
                      </span>
                    </td>
                  </tr>
                ))}

                {(query.data?.length ?? 0) > 5 && (
                  <tr>
                    <td colSpan={4} className="text-center">
                      <button
                        className="btn btn-xs btn-outline"
                        onClick={() => setShowAll(!showAll)}
                      >
                        {showAll ? 'Show Less' : 'Show All'}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export function AccountTransactions({ address }: { address: PublicKey }) {
  const query = useGetSignatures({ address });
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => {
    if (showAll) return query.data;
    return query.data?.slice(0, 5);
  }, [query.data, showAll]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        <div className="space-x-2">
          {query.isLoading ? (
            <span className="loading loading-spinner"></span>
          ) : (
            <button
              className="btn btn-sm btn-outline"
              onClick={() => query.refetch()}
            >
              <IconRefresh size={16} />
            </button>
          )}
        </div>
      </div>
      {query.isError && (
        <pre className="alert alert-error">
          Error: {query.error?.message.toString()}
        </pre>
      )}
      {query.isSuccess && (
        <div>
          {query.data.length === 0 ? (
            <div>No transactions found.</div>
          ) : (
            <table className="table border-4 rounded-lg border-separate border-base-300">
              <thead>
                <tr>
                  <th>Signature</th>
                  <th className="text-right">Slot</th>
                  <th>Block Time</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {items?.map((item) => (
                  <tr key={item.signature}>
                    <th className="font-mono">
                      <ExplorerLink
                        path={`tx/${item.signature}`}
                        label={ellipsify(item.signature, 8)}
                      />
                    </th>
                    <td className="font-mono text-right">
                      <ExplorerLink
                        path={`block/${item.slot}`}
                        label={item.slot.toString()}
                      />
                    </td>
                    <td>
                      {new Date((item.blockTime ?? 0) * 1000).toISOString()}
                    </td>
                    <td className="text-right">
                      {item.err ? (
                        <div
                          className="badge badge-error"
                          title={JSON.stringify(item.err)}
                        >
                          Failed
                        </div>
                      ) : (
                        <div className="badge badge-success">Success</div>
                      )}
                    </td>
                  </tr>
                ))}
                {(query.data?.length ?? 0) > 5 && (
                  <tr>
                    <td colSpan={4} className="text-center">
                      <button
                        className="btn btn-xs btn-outline"
                        onClick={() => setShowAll(!showAll)}
                      >
                        {showAll ? 'Show Less' : 'Show All'}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function BalanceSol({ balance }: { balance: number }) {
  return (
    <span>{Math.round((balance / LAMPORTS_PER_SOL) * 100000) / 100000}</span>
  );
}

function ModalCreateBet({
  hide,
  show,
}: {
  hide: () => void;
  show: boolean;
}) {
  const mutation = useCreateBet();
  const [betSeed, setBetSeed] = useState(0); //vary this to have mutliple open bets from the same creator wallet open at the same time
  const [openUntil, setOpenUntil] = useState(Date.now()); //Bet is open for 30 seconds to be accepted
  const [resolveDate, setResolveDate] = useState(Date.now()); //Bet can be resolved after 35 seconds
  const [pricePrediction, setPricePrediction] = useState(1000 * (10**10)); //actual price prediction needs to be multiplied by 10**10 to enable enough precision using intergers onchain
  const [wagerAmount, setWagerAmount] = useState(0.1 * LAMPORTS_PER_SOL); //wager amount
  const [switchboardFeed, setSwitchboardFeed] = useState("2N5FN6TiH6hVroPkt4zoXHPEsDHp6B8cSV38ALnJic46");  
  const [directionCreator, setDirectionCreator] = useState(true);

  const formatDatetimeLocal = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 16);
  };

  const handleOpenUntilChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    setOpenUntil(date.getTime());
  };

  const handleResolveDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    setResolveDate(date.getTime());
  };

  const handlePricePredictionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPricePrediction(Number(e.target.value)*(10**10));
  };

  const formatPricePrediction = (amount: number) => {
    return (amount / (10**10));
  };

  const handleWagerAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWagerAmount(Number(e.target.value)*LAMPORTS_PER_SOL);
  };
  const formatWagerAmount = (amount: number) => {
    return (amount / LAMPORTS_PER_SOL);
  };
  const formatDirectionCreator = (direction: boolean) => {
    return direction ? "1" : "0";
  };

  const resolveSwitchboardFeed = (feed: string) => {
    if (feed === "2N5FN6TiH6hVroPkt4zoXHPEsDHp6B8cSV38ALnJic46") {
      return "2N5FN6TiH6hVroPkt4zoXHPEsDHp6B8cSV38ALnJic46";
    } else if (feed === "paused") {
      return "paused";
    } else {
      return "custom";
    }
  };

  return (
    <AppModal
      hide={hide}
      show={show}
      title="Create Bet"
      submitDisabled={!switchboardFeed ||mutation.isPending}
      submitLabel="Create Bet"
      submit={() => mutation.mutateAsync({betSeed, openUntil, resolveDate, pricePrediction, wagerAmount, directionCreator, switchboardFeed}).then(() => hide())}
    >
      <Field>
        <Label>Bet Seed</Label>
        <Input
          type="number"
          step="1"
          min="1"
          placeholder="Bet Seed"
          value={betSeed}
          onChange={(e) => setBetSeed(Number(e.target.value))}
        />
      </Field>
      <Field>
        <Label>Open Until</Label>
        <Input
          type="datetime-local"
          step="1"
          min="1"
          placeholder="Open Until"
          value={formatDatetimeLocal(openUntil)}
          onChange={handleOpenUntilChange}
        />
      </Field>
      <Field>
        <Label>Resolve Date</Label>
        <Input
          type="datetime-local"
          step="1"
          min="1"
          placeholder="Resolve Date"
          value={formatDatetimeLocal(resolveDate)}
          onChange={handleResolveDateChange}
        />
      </Field>
      <Field>
        <Label>Price Prediction</Label>
        <Input
          type="number"
          step="any"
          min="0"
          placeholder="Price Prediction"
          value={formatPricePrediction(pricePrediction)}
          onChange={handlePricePredictionChange}
        />
      </Field>
      <Field>
        <Select name="status" value={formatDirectionCreator(directionCreator)} onChange={(e) => setDirectionCreator(e.target.value === "0" ? false : true)}>
          <option value="1">Price will be above prediction</option>
          <option value="0">Price will be below prediction</option>
        </Select>
      </Field>
      <Field>
        <Label>Wager Amount</Label>
        <Input
          type="number"
          step="any"
          min="0"
          placeholder="Wager Amount"
          value={formatWagerAmount(wagerAmount)}
          onChange={handleWagerAmountChange}
        />
      </Field>
      <Field>
        <Label>Switchboard Feed to resolve Bet</Label>
        <Select name="status" value={resolveSwitchboardFeed(switchboardFeed)} onChange={(e) => setSwitchboardFeed(e.target.value)}>
          <option value="2N5FN6TiH6hVroPkt4zoXHPEsDHp6B8cSV38ALnJic46">BONK</option>
          <option value="paused">WIF</option>
          <option value="custom">Custom</option>
        </Select>
      </Field>
      {resolveSwitchboardFeed(switchboardFeed) === 'custom' && (
        <Field>
          <Input
            type="text"
            placeholder="Enter custom Switchboard feed"
            value={switchboardFeed === 'custom' ? '' : switchboardFeed}
            onChange={(e) => setSwitchboardFeed(e.target.value)}
          />
        </Field>
      )}


      <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Field</TableHeader>
          <TableHeader>Value</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
            <TableRow>
              <TableCell className="font-medium">Bet Seed</TableCell>
              <TableCell>{betSeed}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Open Until</TableCell>
              <TableCell>{openUntil}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Resolve Date</TableCell>
              <TableCell>{resolveDate}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Price Prediction</TableCell>
              <TableCell>{pricePrediction}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Direction Creator</TableCell>
              <TableCell>{directionCreator.toString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Wager Amount</TableCell>
              <TableCell>{wagerAmount}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Switchboard Feed</TableCell>
              <TableCell>{switchboardFeed}</TableCell>
            </TableRow>
      </TableBody>
    </Table>

    </AppModal>
  );
}

function ModalCancelBet({
  hide,
  show,
}: {
  hide: () => void;
  show: boolean;
}) {
  const mutation = useCancelBet();
  const [betSeed, setBetSeed] = useState(0); //vary this to have mutliple open bets from the same creator wallet open at the same time
  const [openUntil, setOpenUntil] = useState(Date.now()); //Bet is open for 30 seconds to be accepted
  const [resolveDate, setResolveDate] = useState(Date.now()); //Bet can be resolved after 35 seconds
  const [pricePrediction, setPricePrediction] = useState(1000 * (10**10)); //actual price prediction needs to be multiplied by 10**10 to enable enough precision using intergers onchain
  const [wagerAmount, setWagerAmount] = useState(0.1 * LAMPORTS_PER_SOL); //wager amount
  const [switchboardFeed, setSwitchboardFeed] = useState("2N5FN6TiH6hVroPkt4zoXHPEsDHp6B8cSV38ALnJic46");  
  const [directionCreator, setDirectionCreator] = useState(true);

  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const formatDatetimeLocal = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 16);
  };

  const handleOpenUntilChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    setOpenUntil(date.getTime());
  };

  const handleResolveDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    setResolveDate(date.getTime());
  };

  const handlePricePredictionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPricePrediction(Number(e.target.value)*(10**10));
  };

  const formatPricePrediction = (amount: number) => {
    return (amount / (10**10));
  };

  const handleWagerAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWagerAmount(Number(e.target.value)*LAMPORTS_PER_SOL);
  };
  const formatWagerAmount = (amount: number) => {
    return (amount / LAMPORTS_PER_SOL);
  };
  const formatDirectionCreator = (direction: boolean) => {
    return direction ? "1" : "0";
  };

  const resolveSwitchboardFeed = (feed: string) => {
    if (feed === "2N5FN6TiH6hVroPkt4zoXHPEsDHp6B8cSV38ALnJic46") {
      return "2N5FN6TiH6hVroPkt4zoXHPEsDHp6B8cSV38ALnJic46";
    } else if (feed === "paused") {
      return "paused";
    } else {
      return "custom";
    }
  };
  const handleBetSeedChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleBetSeedChange", e.target.value);
    const newBetSeed = Number(e.target.value);
    setBetSeed(newBetSeed);

    console.log("anchorWallet", anchorWallet);
    if (anchorWallet) {
      const provider = new AnchorProvider(connection, anchorWallet, {});
      const program = new Program<PriceBetting>(IDL, provider);

      const [bet] = PublicKey.findProgramAddressSync([Buffer.from("bet"), BET_PROGRAM.toBuffer(), anchorWallet.publicKey.toBuffer(), new BN(newBetSeed).toArrayLike(Buffer, "le", 8)], program.programId);

      const bettingPool = PublicKey.findProgramAddressSync([Buffer.from("betting_pool"), bet.toBuffer()], program.programId)[0];
      
      try {
        //@ts-ignore
      const initializedBet = await program.account.bet.fetch(bet)
      const wagerAmount = await connection.getBalance(bettingPool)

        console.log("Initialized Bet", initializedBet);
        if (!initializedBet) {
          setResolveDate(Date.parse("1970-01-01"));
          setOpenUntil(Date.parse("1970-01-01"));
          setPricePrediction(0);
          setWagerAmount(0);
          setDirectionCreator(true);
          setSwitchboardFeed("");
        } else {
          const { openUntil, resolveDate, pricePrediction, directionCreator, resolverFeed } = initializedBet;
          setOpenUntil(openUntil.toNumber());
          setResolveDate(resolveDate.toNumber());
          setPricePrediction(pricePrediction.toNumber());
          setWagerAmount(wagerAmount);
          setDirectionCreator(directionCreator);
          setSwitchboardFeed(resolverFeed.toBase58());
        }
      } catch (error) {
        console.error("Error fetching bet:", error);
        setResolveDate(Date.parse("1970-01-01"));
        setOpenUntil(Date.parse("1970-01-01"));
        setPricePrediction(0);
        setWagerAmount(0);
        setDirectionCreator(true);
        setSwitchboardFeed("");
      }
    }
  }, [connection, anchorWallet]);

  return (
    <AppModal
      hide={hide}
      show={show}
      title="Cancel Bet"
      submitLabel="Cancel Bet"
      submit={() => mutation.mutateAsync(new BN(betSeed)).then(() => hide())}
    >
      <Field>
        <Label>Bet Seed</Label>
        <Input
          type="number"
          step="1"
          min="1"
          placeholder="Bet Seed"
          value={betSeed}
          onChange={handleBetSeedChange}
        />
      </Field>
      


      <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Field</TableHeader>
          <TableHeader>Value</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
            <TableRow>
              <TableCell className="font-medium">Bet Seed</TableCell>
              <TableCell>{betSeed}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Open Until</TableCell>
              <TableCell>{openUntil}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Resolve Date</TableCell>
              <TableCell>{resolveDate}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Price Prediction</TableCell>
              <TableCell>{pricePrediction}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Direction Creator</TableCell>
              <TableCell>{directionCreator.toString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Wager Amount</TableCell>
              <TableCell>{wagerAmount}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Switchboard Feed</TableCell>
              <TableCell>{switchboardFeed}</TableCell>
            </TableRow>
      </TableBody>
    </Table>

    </AppModal>
  );
}

function ModalAcceptBet({
  hide,
  show,
}: {
  hide: () => void;
  show: boolean;
}) {
  const mutation = useAcceptBet();
  const [betSeed, setBetSeed] = useState(0); //vary this to have mutliple open bets from the same creator wallet open at the same time
  const [openUntil, setOpenUntil] = useState(Date.now()); //Bet is open for 30 seconds to be accepted
  const [resolveDate, setResolveDate] = useState(Date.now()); //Bet can be resolved after 35 seconds
  const [pricePrediction, setPricePrediction] = useState(1000 * (10**10)); //actual price prediction needs to be multiplied by 10**10 to enable enough precision using intergers onchain
  const [wagerAmount, setWagerAmount] = useState(0.1 * LAMPORTS_PER_SOL); //wager amount
  const [switchboardFeed, setSwitchboardFeed] = useState("2N5FN6TiH6hVroPkt4zoXHPEsDHp6B8cSV38ALnJic46");  
  const [directionCreator, setDirectionCreator] = useState(true);
  const [betCreator, setBetCreator] = useState("");

  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const handleBetSeedChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleBetSeedChange", e.target.value);
    const newBetSeed = Number(e.target.value);
    setBetSeed(newBetSeed);
  
    await update(betCreator, newBetSeed);
    
  }, [connection, anchorWallet, betCreator]);
  
  const handleBetCreatorChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleBetCreatorChange", e.target.value);
    const newBetCreator = e.target.value;
    setBetCreator(newBetCreator);
  
    await update(newBetCreator, betSeed);
  
  }, [connection, anchorWallet, betSeed]);

  const update = async (creator: string, seed: number) => {
    if (anchorWallet) {
      const provider = new AnchorProvider(connection, anchorWallet, {});
      const program = new Program<PriceBetting>(IDL, provider);

      console.log("betCreator", creator);
      console.log("betSeed", seed);

      const bet = PublicKey.findProgramAddressSync([Buffer.from("bet"), BET_PROGRAM.toBuffer(), new PublicKey(creator).toBuffer(), new BN(seed).toArrayLike(Buffer, "le", 8)], program.programId)[0];
      const bettingPool = PublicKey.findProgramAddressSync([Buffer.from("betting_pool"), bet.toBuffer()], program.programId)[0];
      
      try {
        //@ts-ignore
      const initializedBet = await program.account.bet.fetch(bet)
      const wagerAmount = await connection.getBalance(bettingPool)

        console.log("Initialized Bet", initializedBet);
        if (!initializedBet) {
          setResolveDate(Date.parse("1970-01-01"));
          setOpenUntil(Date.parse("1970-01-01"));
          setPricePrediction(0);
          setWagerAmount(0);
          setDirectionCreator(true);
          setSwitchboardFeed("");
        } else {
          const { openUntil, resolveDate, pricePrediction, directionCreator, resolverFeed } = initializedBet;
          setOpenUntil(openUntil.toNumber());
          setResolveDate(resolveDate.toNumber());
          setPricePrediction(pricePrediction.toNumber());
          setWagerAmount(wagerAmount);
          setDirectionCreator(directionCreator);
          setSwitchboardFeed(resolverFeed.toBase58());
        }
      } catch (error) {
        console.error("Error fetching bet:", error);
        setResolveDate(Date.parse("1970-01-01"));
        setOpenUntil(Date.parse("1970-01-01"));
        setPricePrediction(0);
        setWagerAmount(0);
        setDirectionCreator(true);
        setSwitchboardFeed("");
      }
    }
  }

  return (
    <AppModal
      hide={hide}
      show={show}
      title="Accept Bet"
      submitLabel="Accept Bet"
      submit={() => mutation.mutateAsync({betCreator: new PublicKey(betCreator), betSeed: new BN(betSeed)}).then(() => hide())}
    >
      <Field>
        <Label>Bet Creator</Label>
        <Input
          type="text"
          placeholder="Bet Creator"
          value={betCreator}
          onChange={handleBetCreatorChange}
        />
      </Field>
      <Field>
        <Label>Bet Seed</Label>
        <Input
          type="number"
          step="1"
          min="1"
          placeholder="Bet Seed"
          value={betSeed}
          onChange={handleBetSeedChange}
        />
      </Field>

      <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Field</TableHeader>
          <TableHeader>Value</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
            <TableRow>
              <TableCell className="font-medium">Bet Seed</TableCell>
              <TableCell>{betSeed}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Open Until</TableCell>
              <TableCell>{openUntil}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Resolve Date</TableCell>
              <TableCell>{resolveDate}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Price Prediction</TableCell>
              <TableCell>{pricePrediction}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Direction Creator</TableCell>
              <TableCell>{directionCreator.toString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Wager Amount</TableCell>
              <TableCell>{wagerAmount}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Switchboard Feed</TableCell>
              <TableCell>{switchboardFeed}</TableCell>
            </TableRow>
      </TableBody>
    </Table>

    </AppModal>
  );
}

function ModalResolveBet({
  hide,
  show,
}: {
  hide: () => void;
  show: boolean;
}) {
  const mutation = useResolveBet();
  const [betSeed, setBetSeed] = useState(0); //vary this to have mutliple open bets from the same creator wallet open at the same time
  const [openUntil, setOpenUntil] = useState(Date.now()); //Bet is open for 30 seconds to be accepted
  const [resolveDate, setResolveDate] = useState(Date.now()); //Bet can be resolved after 35 seconds
  const [pricePrediction, setPricePrediction] = useState(1000 * (10**10)); //actual price prediction needs to be multiplied by 10**10 to enable enough precision using intergers onchain
  const [wagerAmount, setWagerAmount] = useState(0.1 * LAMPORTS_PER_SOL); //wager amount
  const [switchboardFeed, setSwitchboardFeed] = useState("2N5FN6TiH6hVroPkt4zoXHPEsDHp6B8cSV38ALnJic46");  
  const [directionCreator, setDirectionCreator] = useState(true);
  const [betCreator, setBetCreator] = useState("");
  const [winner, setWinner] = useState("");

  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const handleBetSeedChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleBetSeedChange", e.target.value);
    const newBetSeed = Number(e.target.value);
    setBetSeed(newBetSeed);
  
    await update(betCreator, newBetSeed);
    
  }, [connection, anchorWallet, betCreator]);
  
  const handleBetCreatorChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleBetCreatorChange", e.target.value);
    const newBetCreator = e.target.value;
    setBetCreator(newBetCreator);
  
    await update(newBetCreator, betSeed);
  
  }, [connection, anchorWallet, betSeed]);

  const update = async (creator: string, seed: number) => {
    if (anchorWallet) {
      const provider = new AnchorProvider(connection, anchorWallet, {});
      const program = new Program<PriceBetting>(IDL, provider);

      console.log("betCreator", creator);
      console.log("betSeed", seed);

      const bet = PublicKey.findProgramAddressSync([Buffer.from("bet"), BET_PROGRAM.toBuffer(), new PublicKey(creator).toBuffer(), new BN(seed).toArrayLike(Buffer, "le", 8)], program.programId)[0];
      const bettingPool = PublicKey.findProgramAddressSync([Buffer.from("betting_pool"), bet.toBuffer()], program.programId)[0];
      
      try {
        //@ts-ignore
      const initializedBet = await program.account.bet.fetch(bet)
      const wagerAmount = await connection.getBalance(bettingPool)

        console.log("Initialized Bet", initializedBet);
        if (!initializedBet) {
          setResolveDate(Date.parse("1970-01-01"));
          setOpenUntil(Date.parse("1970-01-01"));
          setPricePrediction(0);
          setWagerAmount(0);
          setDirectionCreator(true);
          setSwitchboardFeed("");
          setWinner("");
        } else {
          const { openUntil, resolveDate, pricePrediction, directionCreator, resolverFeed, winner } = initializedBet;
          console.log("winner", winner);
          setOpenUntil(openUntil.toNumber());
          setResolveDate(resolveDate.toNumber());
          setPricePrediction(pricePrediction.toNumber());
          setWagerAmount(wagerAmount);
          setDirectionCreator(directionCreator);
          setSwitchboardFeed(resolverFeed.toBase58());
          setWinner(winner.toBase58());
        }
      } catch (error) {
        console.error("Error fetching bet:", error);
        setResolveDate(Date.parse("1970-01-01"));
        setOpenUntil(Date.parse("1970-01-01"));
        setPricePrediction(0);
        setWagerAmount(0);
        setDirectionCreator(true);
        setSwitchboardFeed("");
        setWinner("");
      }
    }
  }

  return (
    <AppModal
      hide={hide}
      show={show}
      title="Resolve Bet"
      submitLabel="Resolve Bet"
      submit={() => mutation.mutateAsync({betCreator: new PublicKey(betCreator), betSeed: new BN(betSeed), resolverFeed: new PublicKey(switchboardFeed)}).then(() => hide())}
    >
      <Field>
        <Label>Bet Creator</Label>
        <Input
          type="text"
          placeholder="Bet Creator"
          value={betCreator}
          onChange={handleBetCreatorChange}
        />
      </Field>
      <Field>
        <Label>Bet Seed</Label>
        <Input
          type="number"
          step="1"
          min="1"
          placeholder="Bet Seed"
          value={betSeed}
          onChange={handleBetSeedChange}
        />
      </Field>
      
      <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Field</TableHeader>
          <TableHeader>Value</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
            <TableRow>
              <TableCell className="font-medium">Bet Seed</TableCell>
              <TableCell>{betSeed}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Open Until</TableCell>
              <TableCell>{openUntil}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Resolve Date</TableCell>
              <TableCell>{resolveDate}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Price Prediction</TableCell>
              <TableCell>{pricePrediction}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Direction Creator</TableCell>
              <TableCell>{directionCreator.toString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Wager Amount</TableCell>
              <TableCell>{wagerAmount}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Switchboard Feed</TableCell>
              <TableCell>{switchboardFeed}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Winner</TableCell>
              <TableCell>{winner}</TableCell>
            </TableRow>
      </TableBody>
    </Table>

    </AppModal>
  );
}

function ModalClaimBet({
  hide,
  show,
}: {
  hide: () => void;
  show: boolean;
}) {
  const mutation = useClaimBet();
  const [betSeed, setBetSeed] = useState(0); //vary this to have mutliple open bets from the same creator wallet open at the same time
  const [openUntil, setOpenUntil] = useState(Date.now()); //Bet is open for 30 seconds to be accepted
  const [resolveDate, setResolveDate] = useState(Date.now()); //Bet can be resolved after 35 seconds
  const [pricePrediction, setPricePrediction] = useState(1000 * (10**10)); //actual price prediction needs to be multiplied by 10**10 to enable enough precision using intergers onchain
  const [wagerAmount, setWagerAmount] = useState(0.1 * LAMPORTS_PER_SOL); //wager amount
  const [switchboardFeed, setSwitchboardFeed] = useState("2N5FN6TiH6hVroPkt4zoXHPEsDHp6B8cSV38ALnJic46");  
  const [directionCreator, setDirectionCreator] = useState(true);
  const [betCreator, setBetCreator] = useState("");
  const [winner, setWinner] = useState("");

  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const handleBetSeedChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleBetSeedChange", e.target.value);
    const newBetSeed = Number(e.target.value);
    setBetSeed(newBetSeed);
  
    await update(betCreator, newBetSeed);
    
  }, [connection, anchorWallet, betCreator]);
  
  const handleBetCreatorChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleBetCreatorChange", e.target.value);
    const newBetCreator = e.target.value;
    setBetCreator(newBetCreator);
  
    await update(newBetCreator, betSeed);
  
  }, [connection, anchorWallet, betSeed]);

  const update = async (creator: string, seed: number) => {
    if (anchorWallet) {
      const provider = new AnchorProvider(connection, anchorWallet, {});
      const program = new Program<PriceBetting>(IDL, provider);

      console.log("betCreator", creator);
      console.log("betSeed", seed);

      const bet = PublicKey.findProgramAddressSync([Buffer.from("bet"), BET_PROGRAM.toBuffer(), new PublicKey(creator).toBuffer(), new BN(seed).toArrayLike(Buffer, "le", 8)], program.programId)[0];
      const bettingPool = PublicKey.findProgramAddressSync([Buffer.from("betting_pool"), bet.toBuffer()], program.programId)[0];
      
      try {
        //@ts-ignore
      const initializedBet = await program.account.bet.fetch(bet)
      const wagerAmount = await connection.getBalance(bettingPool)

        console.log("Initialized Bet", initializedBet);
        if (!initializedBet) {
          setResolveDate(Date.parse("1970-01-01"));
          setOpenUntil(Date.parse("1970-01-01"));
          setPricePrediction(0);
          setWagerAmount(0);
          setDirectionCreator(true);
          setSwitchboardFeed("");
          setWinner("");
        } else {
          const { openUntil, resolveDate, pricePrediction, directionCreator, resolverFeed, winner } = initializedBet;
          console.log("winner", winner);
          setOpenUntil(openUntil.toNumber());
          setResolveDate(resolveDate.toNumber());
          setPricePrediction(pricePrediction.toNumber());
          setWagerAmount(wagerAmount);
          setDirectionCreator(directionCreator);
          setSwitchboardFeed(resolverFeed.toBase58());
          setWinner(winner.toBase58());
        }
      } catch (error) {
        console.error("Error fetching bet:", error);
        setResolveDate(Date.parse("1970-01-01"));
        setOpenUntil(Date.parse("1970-01-01"));
        setPricePrediction(0);
        setWagerAmount(0);
        setDirectionCreator(true);
        setSwitchboardFeed("");
        setWinner("");
      }
    }
  }

  return (
    <AppModal
      hide={hide}
      show={show}
      title="Claim Bet"
      submitLabel="Claim Bet"
      submit={() => mutation.mutateAsync({betCreator: new PublicKey(betCreator), betSeed: new BN(betSeed)}).then(() => hide())}
    >
      <Field>
        <Label>Bet Creator</Label>
        <Input
          type="text"
          placeholder="Bet Creator"
          value={betCreator}
          onChange={handleBetCreatorChange}
        />
      </Field>
      <Field>
        <Label>Bet Seed</Label>
        <Input
          type="number"
          step="1"
          min="1"
          placeholder="Bet Seed"
          value={betSeed}
          onChange={handleBetSeedChange}
        />
      </Field>
      
      <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Field</TableHeader>
          <TableHeader>Value</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
            <TableRow>
              <TableCell className="font-medium">Bet Seed</TableCell>
              <TableCell>{betSeed}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Open Until</TableCell>
              <TableCell>{openUntil}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Resolve Date</TableCell>
              <TableCell>{resolveDate}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Price Prediction</TableCell>
              <TableCell>{pricePrediction}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Direction Creator</TableCell>
              <TableCell>{directionCreator.toString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Wager Amount</TableCell>
              <TableCell>{wagerAmount}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Switchboard Feed</TableCell>
              <TableCell>{switchboardFeed}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Winner</TableCell>
              <TableCell>{winner}</TableCell>
            </TableRow>
      </TableBody>
    </Table>

    </AppModal>
  );
}


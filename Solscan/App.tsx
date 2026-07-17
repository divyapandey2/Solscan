import { useState } from 'react';
import {
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  View,
  Platform
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const RPC = 'https://api.mainnet-beta.solana.com';

const rpc = async (method: string, params: any[]) => {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
};

// Solana token program
const getBalance = async (addr: string) => {
  const result = await rpc('getBalance', [addr]);
  return result.value / 1_000_000_000;
};

const getTokens = async (addr: string) => {
  const result = await rpc('getTokenAccountsByOwner', [
    addr,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' },
  ]);
  return (result.value || [])
    .map((a: any) => ({
      mint: a.account.data.parsed.info.mint,
      amount: a.account.data.parsed.info.tokenAmount.uiAmount,
    }))
    .filter((t: any) => t.amount > 0);
};

const getTxns = async (addr: string) => {
  const sigs = await rpc('getSignaturesForAddress', [addr, { limit: 10 }]);
  return sigs.map((s: any) => ({
    sig: s.signature, // Fixed from sigs to sig to match item.sig in JSX
    time: s.blockTime,
    ok: !s.err,
  }));
};

const short = (s: string, n = 4) => {
  if (!s) return '';
  return `${s.slice(0, n)}...${s.slice(-n)}`;
};

const timeAgo = (ts: number) => {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 0) return 'Just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

function MainApp() {
  const insets = useSafeAreaInsets();
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    const addr = address.trim();
    if (!addr) {
      Alert.alert('Error', 'Please enter a Solana wallet address');
      return;
    }
    setLoading(true);
    setSearched(true);
    // Clear previous results to give feedback
    setBalance(null);
    setTokens([]);
    setTxns([]);
    
    try {
      const [balResult, tokenResult, txnResult] = await Promise.all([
        getBalance(addr),
        getTokens(addr),
        getTxns(addr),
      ]);
      setBalance(balResult);
      setTokens(tokenResult);
      setTxns(txnResult);
    } catch (error: any) {
      Alert.alert('Search Error', error.message || 'Failed to fetch wallet info');
      setSearched(false);
    } finally {
      setLoading(false);
    }
  };

  const paddingTop = Math.max(insets.top, 16);

  return (
    <View style={[s.safe, { paddingTop }]}>
      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Solscan</Text>
        <Text style={s.subtitle}>Explore any Solana wallet address</Text>
        
        <View style={s.inputContainer}>
          <TextInput
            style={s.input}
            placeholder="Solana wallet address..."
            placeholderTextColor="#64748B"
            value={address}
            onChangeText={setAddress}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={search}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={s.btnText}>Search Wallet</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        {balance !== null && (
          <View style={s.card}>
            <Text style={s.label}>SOL Balance</Text>
            <View style={s.balanceRow}>
              <Text style={s.balance}>{balance.toFixed(4)}</Text>
              <Text style={s.sol}>SOL</Text>
            </View>
          </View>
        )}

        {/* Tokens Section */}
        {searched && (
          <View style={s.sectionContainer}>
            <Text style={s.section}>
              Tokens {tokens.length > 0 ? `(${tokens.length})` : ''}
            </Text>
            {loading ? (
              <ActivityIndicator color="#8C52FF" style={{ marginVertical: 12 }} />
            ) : tokens.length === 0 ? (
              <View style={s.infoCard}>
                <Text style={s.infoText}>No SPL tokens found in this wallet</Text>
              </View>
            ) : (
              tokens.slice(0, 5).map((item) => (
                <View key={item.mint} style={s.row}>
                  <View>
                    <Text style={s.rowLabel}>Token Mint</Text>
                    <Text style={s.mint}>{short(item.mint, 6)}</Text>
                  </View>
                  <View style={s.amountContainer}>
                    <Text style={s.rowLabel}>Balance</Text>
                    <Text style={s.amount}>{item.amount}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Transactions Section */}
        {searched && (
          <View style={s.sectionContainer}>
            <Text style={s.section}>Recent Transactions</Text>
            {loading ? (
              <ActivityIndicator color="#8C52FF" style={{ marginVertical: 12 }} />
            ) : txns.length === 0 ? (
              <View style={s.infoCard}>
                <Text style={s.infoText}>No recent transactions found</Text>
              </View>
            ) : (
              txns.map((item) => (
                <TouchableOpacity
                  key={item.sig}
                  style={s.row}
                  onPress={() => Linking.openURL(`https://solscan.io/tx/${item.sig}`)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>Tx Signature</Text>
                    <Text style={s.mint}>{short(item.sig, 8)}</Text>
                    <Text style={s.time}>
                      {item.time ? timeAgo(item.time) : 'pending'}
                    </Text>
                  </View>
                  <View style={s.statusBadge}>
                    <Text style={[
                      s.statusIcon,
                      { color: item.ok ? '#14F195' : '#EF4444' }
                    ]}>
                      {item.ok ? '✓ Success' : '✗ Failed'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0813',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#14F195',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9E9BAE',
    marginTop: 6,
    marginBottom: 28,
  },
  inputContainer: {
    backgroundColor: '#141221',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2D2845',
    paddingHorizontal: 16,
    height: 54,
    justifyContent: 'center',
    marginBottom: 16,
  },
  input: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    width: '100%',
  },
  btnRow: {
    marginBottom: 32,
  },
  btn: {
    backgroundColor: '#8C52FF',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8C52FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: '#4C2D8C',
    opacity: 0.6,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#141221',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2845',
    padding: 20,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    color: '#9E9BAE',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  balance: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  sol: {
    color: '#14F195',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  sectionContainer: {
    marginBottom: 28,
  },
  section: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#141221',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2845',
    padding: 16,
    marginBottom: 12,
  },
  rowLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  mint: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    color: '#14F195',
    fontSize: 15,
    fontWeight: '700',
  },
  time: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  statusBadge: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  statusIcon: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#141221',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2845',
    padding: 16,
    alignItems: 'center',
    marginBottom: 28,
  },
  infoText: {
    color: '#9E9BAE',
    fontSize: 14,
    fontWeight: '500',
  },
});

import { useState } from 'react';
import {
TextInput,
TouchableOpacity,
FlatList,
ScrollView,
ActivityIndicator,
Alert,
Linking,
StyleSheet,
Text,
View
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

const RPC= 'https://api.mainnet-beta.solana.com';
const rpc=async (method:string, params:any[]) => {
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
  const json= await res.json();
  if(json.error)throw new Error(json.error.message);
  return json.result;
}
//Solana token program
const getBalance=async (addr:string) => {
  const result= await rpc('getBalance', [addr]);
  return result.value/1_000_000_000;
};

const getTokens=async (addr:string) => {
  const result= await rpc('getTokenAccountsByOwner', 
    [addr,
       {programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'},
       {encoding: 'jsonParsed'}]);
  return (result.value || [])
  .map((a:any) => ({
    mint: a.account.data.parsed.info.mint,
    amount: a.account.data.parsed.info.tokenAmount.uiAmount,
  }))
  .filter((t:any) => t.amount > 0);
};
const getTxns =async (addr:string) => {
  const sigs= await rpc('getSignaturesForAddress', [addr, {limit: 10}]);
  return sigs.map((s:any) => ({
    sigs: s.signature,
    time: s.blockTime,
    ok:!s.err,
  }));
};

const short=(s:string,n=4) => `${s.slice(0,n)}...${s.slice(-n)}`;
 
const timeAgo=(ts:number)=>{
  const s=Math.floor(Date.now()/1000 -ts);
  if(s<60) return `${s}s ago`;
  if(s<3600) return `${Math.floor(s/60)}m ago`;
  if(s<86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}
export default function App() {

  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);

  const search = async ()=>{
    const addr=address.trim();
    setLoading(true);
    try{
      const [balance, tokens, txns] = await Promise.all([
        getBalance(addr),
        getTokens(addr),
        getTxns(addr),
      ]);
      setBalance(balance);
      setTokens(tokens);
      setTxns(txns);
    }catch(error:any){
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  }
  
  return (
    <SafeAreaView style={s.safe}>
    <ScrollView style={s.scroll}>
    <Text style={s.title}>Solscan</Text>
    <Text style={s.subtitle}>Explore any Solana wallet </Text>
    <View style={s.inputContainer}> 
    <TextInput
      style={s.input}
      placeholder="Solana wallet address...."
      placeholderTextColor="#687280"
      value={address}
      onChangeText={setAddress}
      autoCapitalize='none'
      autoCorrect={false}
    />
    </View>
    <View style={s.btnRow}>
      <TouchableOpacity
        style={[s.btn, loading && s.btnDisabled ]}
        onPress={search}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={s.btnText}>Search</Text>
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
    {/* Tokens */}
    {tokens.length > 0 && (
      <>
      <Text style={s.section}>Tokens({tokens.length})</Text>
      <FlatList
        data={tokens.slice(0,5 )}
        keyExtractor={(t) => t.mint}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={s.row}>
            <Text style={s.mint}>{short(item.mint, 6)}</Text>
            <Text style={s.amount}>{item.amount}</Text>
          </View>
        )}
      />
      </>
    )}
    {/* Transactions */}
    {txns.length > 0 && (
      <>
      <Text style={s.section}>Recent Transactions</Text>
      <FlatList
        data={txns}
        keyExtractor={(t) => t.sig}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity
          style={s.row}
          onPress={() => Linking.openURL(`https://solscan.io/tx/${item.sig}`)}
          activeOpacity={0.7}
          >
         <View>
          <Text style={s.mint}>{short(item.sig, 8)}</Text>
          <Text style={s.time}>
            {item.time ? timeAgo(item.time) : 'pending'}
          </Text>
         </View>
         <Text style={[
          s.statusIcon,
          {color: item.ok ? '#14F195' : '#EF4444'}
        ]}>
          {item.ok ? '+' : '-'}
         </Text>
          </TouchableOpacity>

        )}
      />
      </>
    )}
    </ScrollView>
        </SafeAreaView>
  );
}

const s = StyleSheet.create({
row:{
    borderWidth: 1,
    borderColor: "#2A2A35"
  },
mint:{
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily:"monospace",
    fontWeight: "500",
  },
amount:{
    color: "#14F195",
    fontSize: 15,
    fontWeight: "600",
  },
time:{
    color: "#687280",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
statusIcon:{
    fontSize: 18,
    fontWeight: "400",
  },

});

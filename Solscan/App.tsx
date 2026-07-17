import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import WalletScreen from "./src/screens/WalletScreen";
import SwapScreen from "./src/screens/SwapScreen";
const Tab = createBottomTabNavigator();
export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Wallet" component={WalletScreen} />
        <Tab.Screen name="Swap" component={SwapScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
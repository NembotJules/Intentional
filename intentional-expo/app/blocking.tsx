/** US-103 · Blocking lives in the Block tab now; old links (Focus, notifications) land there. */
import { Redirect } from 'expo-router';

export default function BlockingRedirect() {
  return <Redirect href="/(tabs)/block" />;
}

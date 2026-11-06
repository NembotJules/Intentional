/** US-102 · Insights became the Progress tab; old links and notifications land there. */
import { Redirect } from 'expo-router';

export default function InsightsRedirect() {
  return <Redirect href="/(tabs)/progress" />;
}

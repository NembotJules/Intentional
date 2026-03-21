import { Dimensions, Image, View } from 'react-native';

const { height } = Dimensions.get('window');
const scanlineCount = Math.ceil(height / 4);

export function GrainOverlay() {
  return (
    <View className="absolute inset-0" style={{ zIndex: 98 }} pointerEvents="none">
      <Image
        source={require('../assets/grain.png')}
        resizeMode="repeat"
        className="absolute inset-0"
        style={{ opacity: 0.04 }}
      />
    </View>
  );
}

export function ScanlineOverlay() {
  return (
    <View className="absolute inset-0" style={{ zIndex: 99 }} pointerEvents="none">
      {new Array(scanlineCount).fill(0).map((_, idx) => (
        <View
          key={idx}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: idx * 4 + 3,
            height: 1,
            backgroundColor: 'rgba(0,0,0,0.05)',
          }}
        />
      ))}
    </View>
  );
}

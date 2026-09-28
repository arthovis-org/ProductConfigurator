import { Bounds, ContactShadows, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { LoadingIndicator } from './LoadingIndicator';
import { StudioEnvironment } from './StudioEnvironment';
import { ViewerErrorBoundary } from './ViewerErrorBoundary';
import { preloadCurrentProduct } from './models';
import { ProductModel } from './ProductModel';
import styles from './Scene.module.css';

// This module is loaded lazily, and this is the earliest point where three is available.
preloadCurrentProduct();

/** Studio-style viewer: soft environment light, contact shadow, damped orbit controls. */
export function Scene() {
  return (
    <div className={styles.viewer}>
      <Canvas
        // Render only when something changes (camera, selection); the scene is static otherwise.
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [2.2, 1.4, 2.6], fov: 35, near: 0.05, far: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ViewerErrorBoundary>
          <Suspense fallback={<LoadingIndicator />}>
            <Bounds fit clip observe margin={1.25}>
              <ProductModel />
            </Bounds>
          </Suspense>
        </ViewerErrorBoundary>
        <StudioEnvironment />
        <directionalLight position={[3, 5, 2]} intensity={1.2} />
        <ContactShadows
          position={[0, -0.001, 0]}
          opacity={0.55}
          scale={5}
          blur={1.6}
          // Tall enough to catch a desk top at standing height.
          far={2}
          resolution={1024}
        />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={1}
          maxDistance={6}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2 - 0.02}
          // No fixed target: `Bounds` points the controls at the centre of what it frames,
          // which includes the full height range of a motorised desk.
        />
      </Canvas>
    </div>
  );
}

import * as THREE from 'three';

/**
 * Triplanar world-space stone.
 *
 * The colonnade is built from instanced boxes at wildly different sizes. A box
 * carries UVs of 0..1 per face, so an ordinary material squeezes a whole
 * texture onto a thin moulding and stretches it along a tall shaft — which is
 * exactly what makes procedural architecture read as stacked planks.
 *
 * Projecting the texture from the three world axes instead means the grain is
 * the same real-world size on every surface, regardless of the box it belongs
 * to, with no seams and no UV authoring. Normals use the whiteout blend, so
 * relief survives the projection.
 *
 * `scale` is in texture repeats per metre: 0.5 gives a ~2m stone course.
 */
export function makeStoneMaterial({ map, normalMap, armMap, scale = 0.5, ...options }) {
  const material = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    aoMap: armMap,
    roughnessMap: armMap,
    metalnessMap: armMap,
    metalness: 1,
    roughness: 1,
    ...options,
  });

  material.userData.triplanarScale = { value: scale };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.triplanarScale = material.userData.triplanarScale;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vTriPos;
        varying vec3 vTriNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vTriPos = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
          vTriNormal = normalize( mat3( modelMatrix ) * ( mat3( instanceMatrix ) * objectNormal ) );
        #else
          vTriPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
          vTriNormal = normalize( mat3( modelMatrix ) * objectNormal );
        #endif`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vTriPos;
        varying vec3 vTriNormal;
        uniform float triplanarScale;

        vec3 triBlendWeights() {
          vec3 blend = pow( abs( vTriNormal ), vec3( 6.0 ) );
          return blend / max( 1e-5, blend.x + blend.y + blend.z );
        }

        vec4 triSample( sampler2D tex, vec3 blend ) {
          float s = triplanarScale;
          return texture2D( tex, vTriPos.zy * s ) * blend.x
               + texture2D( tex, vTriPos.xz * s ) * blend.y
               + texture2D( tex, vTriPos.xy * s ) * blend.z;
        }`)

      // Diffuse, projected from the three axes.
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          diffuseColor *= triSample( map, triBlendWeights() );
        #endif`)

      // ARM packs occlusion, roughness and metalness into R, G and B.
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        #ifdef USE_ROUGHNESSMAP
          roughnessFactor *= triSample( roughnessMap, triBlendWeights() ).g;
        #endif`)
      .replace('#include <metalnessmap_fragment>', `
        float metalnessFactor = metalness;
        #ifdef USE_METALNESSMAP
          metalnessFactor *= triSample( metalnessMap, triBlendWeights() ).b;
        #endif`)
      .replace('#include <aomap_fragment>', `
        #ifdef USE_AOMAP
          float ambientOcclusion = ( triSample( aoMap, triBlendWeights() ).r - 1.0 ) * aoMapIntensity + 1.0;
          reflectedLight.indirectDiffuse *= ambientOcclusion;
          #if defined( USE_CLEARCOAT )
            clearcoatSpecularIndirect *= ambientOcclusion;
          #endif
          #if defined( USE_SHEEN )
            sheenSpecularIndirect *= ambientOcclusion;
          #endif
          #if defined( USE_ENVMAP ) && defined( STANDARD )
            float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
            reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
          #endif
        #endif`)

      // Whiteout blend: keeps relief detail without tangents or UV seams.
      .replace('#include <normal_fragment_maps>', `
        #ifdef USE_NORMALMAP
          vec3 triBlend = triBlendWeights();
          float triScale = triplanarScale;
          vec3 nx = texture2D( normalMap, vTriPos.zy * triScale ).xyz * 2.0 - 1.0;
          vec3 ny = texture2D( normalMap, vTriPos.xz * triScale ).xyz * 2.0 - 1.0;
          vec3 nz = texture2D( normalMap, vTriPos.xy * triScale ).xyz * 2.0 - 1.0;
          nx.xy *= normalScale;
          ny.xy *= normalScale;
          nz.xy *= normalScale;
          vec3 axisSign = sign( vTriNormal );
          nx = vec3( nx.xy + vTriNormal.zy, abs( nx.z ) * vTriNormal.x );
          ny = vec3( ny.xy + vTriNormal.xz, abs( ny.z ) * vTriNormal.y );
          nz = vec3( nz.xy + vTriNormal.xy, abs( nz.z ) * vTriNormal.z );
          vec3 worldNormal = normalize( nx.zyx * triBlend.x + ny.xzy * triBlend.y + nz.xyz * triBlend.z );
          normal = normalize( ( viewMatrix * vec4( worldNormal, 0.0 ) ).xyz );
        #endif`);
  };

  // Distinguishes this program from an unpatched standard material.
  material.customProgramCacheKey = () => 'triplanar-stone';
  return material;
}

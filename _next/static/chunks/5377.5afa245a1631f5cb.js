"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[5377],{23264:(e,t,i)=>{i.d(t,{p:()=>s});var a=i(85339),r=i(63617);class s extends r.o{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof a.BKk?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=a.LlO.clone(e.uniforms),this.material=new a.BKk({name:void 0!==e.name?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new r.F(this.material)}render(e,t,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this._fsQuad.material=this.material,this.renderToScreen?e.setRenderTarget(null):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil)),this._fsQuad.render(e)}dispose(){this.material.dispose(),this._fsQuad.dispose()}}},23464:(e,t,i)=>{i.d(t,{X:()=>n});var a=i(85339),r=i(63617);let s={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class n extends r.o{constructor(){super(),this.uniforms=a.LlO.clone(s.uniforms),this.material=new a.D$Q({name:s.name,uniforms:this.uniforms,vertexShader:s.vertexShader,fragmentShader:s.fragmentShader}),this._fsQuad=new r.F(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},a.ppV.getTransfer(this._outputColorSpace)===a.KLL&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===a.kyO?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===a.Mjd?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===a.nNL?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===a.FV?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===a.LAk?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===a.aJ8?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===a.g7M&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),!0===this.renderToScreen?e.setRenderTarget(null):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil)),this._fsQuad.render(e)}dispose(){this.material.dispose(),this._fsQuad.dispose()}}},30860:(e,t,i)=>{i.d(t,{o:()=>a});let a={name:"FXAAShader",uniforms:{tDiffuse:{value:null},resolution:{value:new(i(85339)).I9Y(1/1024,1/512)}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec2 resolution;
		varying vec2 vUv;

		#define EDGE_STEP_COUNT 6
		#define EDGE_GUESS 8.0
		#define EDGE_STEPS 1.0, 1.5, 2.0, 2.0, 2.0, 4.0
		const float edgeSteps[EDGE_STEP_COUNT] = float[EDGE_STEP_COUNT]( EDGE_STEPS );

		float _ContrastThreshold = 0.0312;
		float _RelativeThreshold = 0.063;
		float _SubpixelBlending = 1.0;

		vec4 Sample( sampler2D  tex2D, vec2 uv ) {

			return texture( tex2D, uv );

		}

		float SampleLuminance( sampler2D tex2D, vec2 uv ) {

			return dot( Sample( tex2D, uv ).rgb, vec3( 0.3, 0.59, 0.11 ) );

		}

		float SampleLuminance( sampler2D tex2D, vec2 texSize, vec2 uv, float uOffset, float vOffset ) {

			uv += texSize * vec2(uOffset, vOffset);
			return SampleLuminance(tex2D, uv);

		}

		struct LuminanceData {

			float m, n, e, s, w;
			float ne, nw, se, sw;
			float highest, lowest, contrast;

		};

		LuminanceData SampleLuminanceNeighborhood( sampler2D tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData l;
			l.m = SampleLuminance( tex2D, uv );
			l.n = SampleLuminance( tex2D, texSize, uv,  0.0,  1.0 );
			l.e = SampleLuminance( tex2D, texSize, uv,  1.0,  0.0 );
			l.s = SampleLuminance( tex2D, texSize, uv,  0.0, -1.0 );
			l.w = SampleLuminance( tex2D, texSize, uv, -1.0,  0.0 );

			l.ne = SampleLuminance( tex2D, texSize, uv,  1.0,  1.0 );
			l.nw = SampleLuminance( tex2D, texSize, uv, -1.0,  1.0 );
			l.se = SampleLuminance( tex2D, texSize, uv,  1.0, -1.0 );
			l.sw = SampleLuminance( tex2D, texSize, uv, -1.0, -1.0 );

			l.highest = max( max( max( max( l.n, l.e ), l.s ), l.w ), l.m );
			l.lowest = min( min( min( min( l.n, l.e ), l.s ), l.w ), l.m );
			l.contrast = l.highest - l.lowest;
			return l;

		}

		bool ShouldSkipPixel( LuminanceData l ) {

			float threshold = max( _ContrastThreshold, _RelativeThreshold * l.highest );
			return l.contrast < threshold;

		}

		float DeterminePixelBlendFactor( LuminanceData l ) {

			float f = 2.0 * ( l.n + l.e + l.s + l.w );
			f += l.ne + l.nw + l.se + l.sw;
			f *= 1.0 / 12.0;
			f = abs( f - l.m );
			f = clamp( f / l.contrast, 0.0, 1.0 );

			float blendFactor = smoothstep( 0.0, 1.0, f );
			return blendFactor * blendFactor * _SubpixelBlending;

		}

		struct EdgeData {

			bool isHorizontal;
			float pixelStep;
			float oppositeLuminance, gradient;

		};

		EdgeData DetermineEdge( vec2 texSize, LuminanceData l ) {

			EdgeData e;
			float horizontal =
				abs( l.n + l.s - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.se - 2.0 * l.e ) +
				abs( l.nw + l.sw - 2.0 * l.w );
			float vertical =
				abs( l.e + l.w - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.nw - 2.0 * l.n ) +
				abs( l.se + l.sw - 2.0 * l.s );
			e.isHorizontal = horizontal >= vertical;

			float pLuminance = e.isHorizontal ? l.n : l.e;
			float nLuminance = e.isHorizontal ? l.s : l.w;
			float pGradient = abs( pLuminance - l.m );
			float nGradient = abs( nLuminance - l.m );

			e.pixelStep = e.isHorizontal ? texSize.y : texSize.x;

			if (pGradient < nGradient) {

				e.pixelStep = -e.pixelStep;
				e.oppositeLuminance = nLuminance;
				e.gradient = nGradient;

			} else {

				e.oppositeLuminance = pLuminance;
				e.gradient = pGradient;

			}

			return e;

		}

		float DetermineEdgeBlendFactor( sampler2D  tex2D, vec2 texSize, LuminanceData l, EdgeData e, vec2 uv ) {

			vec2 uvEdge = uv;
			vec2 edgeStep;
			if (e.isHorizontal) {

				uvEdge.y += e.pixelStep * 0.5;
				edgeStep = vec2( texSize.x, 0.0 );

			} else {

				uvEdge.x += e.pixelStep * 0.5;
				edgeStep = vec2( 0.0, texSize.y );

			}

			float edgeLuminance = ( l.m + e.oppositeLuminance ) * 0.5;
			float gradientThreshold = e.gradient * 0.25;

			vec2 puv = uvEdge + edgeStep * edgeSteps[0];
			float pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
			bool pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !pAtEnd; i++ ) {

				puv += edgeStep * edgeSteps[i];
				pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
				pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			}

			if ( !pAtEnd ) {

				puv += edgeStep * EDGE_GUESS;

			}

			vec2 nuv = uvEdge - edgeStep * edgeSteps[0];
			float nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
			bool nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !nAtEnd; i++ ) {

				nuv -= edgeStep * edgeSteps[i];
				nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
				nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			}

			if ( !nAtEnd ) {

				nuv -= edgeStep * EDGE_GUESS;

			}

			float pDistance, nDistance;
			if ( e.isHorizontal ) {

				pDistance = puv.x - uv.x;
				nDistance = uv.x - nuv.x;

			} else {

				pDistance = puv.y - uv.y;
				nDistance = uv.y - nuv.y;

			}

			float shortestDistance;
			bool deltaSign;
			if ( pDistance <= nDistance ) {

				shortestDistance = pDistance;
				deltaSign = pLuminanceDelta >= 0.0;

			} else {

				shortestDistance = nDistance;
				deltaSign = nLuminanceDelta >= 0.0;

			}

			if ( deltaSign == ( l.m - edgeLuminance >= 0.0 ) ) {

				return 0.0;

			}

			return 0.5 - shortestDistance / ( pDistance + nDistance );

		}

		vec4 ApplyFXAA( sampler2D  tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData luminance = SampleLuminanceNeighborhood( tex2D, texSize, uv );
			if ( ShouldSkipPixel( luminance ) ) {

				return Sample( tex2D, uv );

			}

			float pixelBlend = DeterminePixelBlendFactor( luminance );
			EdgeData edge = DetermineEdge( texSize, luminance );
			float edgeBlend = DetermineEdgeBlendFactor( tex2D, texSize, luminance, edge, uv );
			float finalBlend = max( pixelBlend, edgeBlend );

			if (edge.isHorizontal) {

				uv.y += edge.pixelStep * finalBlend;

			} else {

				uv.x += edge.pixelStep * finalBlend;

			}

			return Sample( tex2D, uv );

		}

		void main() {

			gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );

		}`}},52049:(e,t,i)=>{i.d(t,{Z:()=>a});let a={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`}},53789:(e,t,i)=>{i.d(t,{A:()=>s});var a=i(85339),r=i(63617);class s extends r.o{constructor(e,t,i=null,r=null,s=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=i,this.clearColor=r,this.clearAlpha=s,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new a.Q1f}render(e,t,i){let a,r,s=e.autoClear;e.autoClear=!1,null!==this.overrideMaterial&&(r=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),null!==this.clearColor&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),null!==this.clearAlpha&&(a=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),!0==this.clearDepth&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:i),!0===this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),null!==this.clearColor&&e.setClearColor(this._oldClearColor),null!==this.clearAlpha&&e.setClearAlpha(a),null!==this.overrideMaterial&&(this.scene.overrideMaterial=r),e.autoClear=s}}},58745:(e,t,i)=>{i.d(t,{j:()=>n});var a=i(85339);let r=new a.Pq0;function s(e,t,i,a,s,n){let l=2*Math.PI*s/4,o=Math.max(n-2*s,0),h=Math.PI/4;r.copy(t),r[a]=0,r.normalize();let u=.5*l/(l+o),d=1-r.angleTo(e)/h;return 1===Math.sign(r[i])?d*u:o/(l+o)+u+u*(1-d)}class n extends a.iNn{constructor(e=1,t=1,i=1,r=2,n=.1){let l=2*r+1;if(n=Math.min(e/2,t/2,i/2,n),super(1,1,1,l,l,l),this.type="RoundedBoxGeometry",this.parameters={width:e,height:t,depth:i,segments:r,radius:n},1===l)return;let o=this.toNonIndexed();this.index=null,this.attributes.position=o.attributes.position,this.attributes.normal=o.attributes.normal,this.attributes.uv=o.attributes.uv;let h=new a.Pq0,u=new a.Pq0,d=new a.Pq0(e,t,i).divideScalar(2).subScalar(n),c=this.attributes.position.array,p=this.attributes.normal.array,f=this.attributes.uv.array,m=c.length/6,v=new a.Pq0,g=.5/l;for(let a=0,r=0;a<c.length;a+=3,r+=2)switch(h.fromArray(c,a),u.copy(h),u.x-=Math.sign(u.x)*g,u.y-=Math.sign(u.y)*g,u.z-=Math.sign(u.z)*g,u.normalize(),c[a+0]=d.x*Math.sign(h.x)+u.x*n,c[a+1]=d.y*Math.sign(h.y)+u.y*n,c[a+2]=d.z*Math.sign(h.z)+u.z*n,p[a+0]=u.x,p[a+1]=u.y,p[a+2]=u.z,Math.floor(a/m)){case 0:v.set(1,0,0),f[r+0]=s(v,u,"z","y",n,i),f[r+1]=1-s(v,u,"y","z",n,t);break;case 1:v.set(-1,0,0),f[r+0]=1-s(v,u,"z","y",n,i),f[r+1]=1-s(v,u,"y","z",n,t);break;case 2:v.set(0,1,0),f[r+0]=1-s(v,u,"x","z",n,e),f[r+1]=s(v,u,"z","x",n,i);break;case 3:v.set(0,-1,0),f[r+0]=1-s(v,u,"x","z",n,e),f[r+1]=1-s(v,u,"z","x",n,i);break;case 4:v.set(0,0,1),f[r+0]=1-s(v,u,"x","y",n,e),f[r+1]=1-s(v,u,"y","x",n,t);break;case 5:v.set(0,0,-1),f[r+0]=s(v,u,"x","y",n,e),f[r+1]=1-s(v,u,"y","x",n,t)}}static fromJSON(e){return new n(e.width,e.height,e.depth,e.segments,e.radius)}}},63617:(e,t,i)=>{i.d(t,{F:()=>o,o:()=>r});var a=i(85339);class r{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}let s=new a.qUd(-1,1,1,-1,0,1);class n extends a.LoY{constructor(){super(),this.setAttribute("position",new a.qtW([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new a.qtW([0,2,0,0,2,0],2))}}let l=new n;class o{constructor(e){this._mesh=new a.eaF(l,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,s)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}},69285:(e,t,i)=>{i.d(t,{C:()=>u});var a=i(85339),r=i(63617);class s{constructor(e=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let t=0;t<256;t++)this.p[t]=Math.floor(256*e.random());this.perm=[];for(let e=0;e<512;e++)this.perm[e]=this.p[255&e];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}noise(e,t){let i,a,r,s,n,l=.5*(Math.sqrt(3)-1)*(e+t),o=Math.floor(e+l),h=Math.floor(t+l),u=(3-Math.sqrt(3))/6,d=(o+h)*u,c=e-(o-d),p=t-(h-d);c>p?(s=1,n=0):(s=0,n=1);let f=c-s+u,m=p-n+u,v=c-1+2*u,g=p-1+2*u,x=255&o,S=255&h,_=this.perm[x+this.perm[S]]%12,D=this.perm[x+s+this.perm[S+n]]%12,M=this.perm[x+1+this.perm[S+1]]%12,w=.5-c*c-p*p;w<0?i=0:(w*=w,i=w*w*this._dot(this.grad3[_],c,p));let C=.5-f*f-m*m;C<0?a=0:(C*=C,a=C*C*this._dot(this.grad3[D],f,m));let T=.5-v*v-g*g;return T<0?r=0:(T*=T,r=T*T*this._dot(this.grad3[M],v,g)),70*(i+a+r)}noise3d(e,t,i){let a,r,s,n,l,o,h,u,d,c,p=1/3*(e+t+i),f=Math.floor(e+p),m=Math.floor(t+p),v=Math.floor(i+p),g=1/6*(f+m+v),x=e-(f-g),S=t-(m-g),_=i-(v-g);x>=S?S>=_?(l=1,o=0,h=0,u=1,d=1,c=0):(x>=_?(l=1,o=0,h=0):(l=0,o=0,h=1),u=1,d=0,c=1):S<_?(l=0,o=0,h=1,u=0,d=1,c=1):x<_?(l=0,o=1,h=0,u=0,d=1,c=1):(l=0,o=1,h=0,u=1,d=1,c=0);let D=x-l+1/6,M=S-o+1/6,w=_-h+1/6,C=x-u+1/6*2,T=S-d+1/6*2,E=_-c+1/6*2,b=x-1+1/6*3,P=S-1+1/6*3,R=_-1+1/6*3,A=255&f,L=255&m,N=255&v,y=this.perm[A+this.perm[L+this.perm[N]]]%12,z=this.perm[A+l+this.perm[L+o+this.perm[N+h]]]%12,F=this.perm[A+u+this.perm[L+d+this.perm[N+c]]]%12,O=this.perm[A+1+this.perm[L+1+this.perm[N+1]]]%12,k=.6-x*x-S*S-_*_;k<0?a=0:(k*=k,a=k*k*this._dot3(this.grad3[y],x,S,_));let I=.6-D*D-M*M-w*w;I<0?r=0:(I*=I,r=I*I*this._dot3(this.grad3[z],D,M,w));let U=.6-C*C-T*T-E*E;U<0?s=0:(U*=U,s=U*U*this._dot3(this.grad3[F],C,T,E));let G=.6-b*b-P*P-R*R;return G<0?n=0:(G*=G,n=G*G*this._dot3(this.grad3[O],b,P,R)),32*(a+r+s+n)}noise4d(e,t,i,a){let r,s,n,l,o,h=this.grad4,u=this.simplex,d=this.perm,c=(5-Math.sqrt(5))/20,p=(Math.sqrt(5)-1)/4*(e+t+i+a),f=Math.floor(e+p),m=Math.floor(t+p),v=Math.floor(i+p),g=Math.floor(a+p),x=(f+m+v+g)*c,S=e-(f-x),_=t-(m-x),D=i-(v-x),M=a-(g-x),w=32*(S>_)+16*(S>D)+8*(_>D)+4*(S>M)+2*(_>M)+ +(D>M),C=+(u[w][0]>=3),T=+(u[w][1]>=3),E=+(u[w][2]>=3),b=+(u[w][3]>=3),P=+(u[w][0]>=2),R=+(u[w][1]>=2),A=+(u[w][2]>=2),L=+(u[w][3]>=2),N=+(u[w][0]>=1),y=+(u[w][1]>=1),z=+(u[w][2]>=1),F=+(u[w][3]>=1),O=S-C+c,k=_-T+c,I=D-E+c,U=M-b+c,G=S-P+2*c,B=_-R+2*c,j=D-A+2*c,Z=M-L+2*c,V=S-N+3*c,K=_-y+3*c,Q=D-z+3*c,q=M-F+3*c,X=S-1+4*c,H=_-1+4*c,W=D-1+4*c,Y=M-1+4*c,J=255&f,$=255&m,ee=255&v,et=255&g,ei=d[J+d[$+d[ee+d[et]]]]%32,ea=d[J+C+d[$+T+d[ee+E+d[et+b]]]]%32,er=d[J+P+d[$+R+d[ee+A+d[et+L]]]]%32,es=d[J+N+d[$+y+d[ee+z+d[et+F]]]]%32,en=d[J+1+d[$+1+d[ee+1+d[et+1]]]]%32,el=.6-S*S-_*_-D*D-M*M;el<0?r=0:(el*=el,r=el*el*this._dot4(h[ei],S,_,D,M));let eo=.6-O*O-k*k-I*I-U*U;eo<0?s=0:(eo*=eo,s=eo*eo*this._dot4(h[ea],O,k,I,U));let eh=.6-G*G-B*B-j*j-Z*Z;eh<0?n=0:(eh*=eh,n=eh*eh*this._dot4(h[er],G,B,j,Z));let eu=.6-V*V-K*K-Q*Q-q*q;eu<0?l=0:(eu*=eu,l=eu*eu*this._dot4(h[es],V,K,Q,q));let ed=.6-X*X-H*H-W*W-Y*Y;return ed<0?o=0:(ed*=ed,o=ed*ed*this._dot4(h[en],X,H,W,Y)),27*(r+s+n+l+o)}_dot(e,t,i){return e[0]*t+e[1]*i}_dot3(e,t,i,a){return e[0]*t+e[1]*i+e[2]*a}_dot4(e,t,i,a,r){return e[0]*t+e[1]*i+e[2]*a+e[3]*r}}let n={name:"SSAOShader",defines:{PERSPECTIVE_CAMERA:1,KERNEL_SIZE:32},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},kernel:{value:null},cameraNear:{value:null},cameraFar:{value:null},resolution:{value:new a.I9Y},cameraProjectionMatrix:{value:new a.kn4},cameraInverseProjectionMatrix:{value:new a.kn4},kernelRadius:{value:8},minDistance:{value:.005},maxDistance:{value:.05}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;

		uniform vec3 kernel[ KERNEL_SIZE ];

		uniform vec2 resolution;

		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraInverseProjectionMatrix;

		uniform float kernelRadius;
		uniform float minDistance; // avoid artifacts caused by neighbour fragments with minimal depth difference
		uniform float maxDistance; // avoid the influence of fragments which are too far away

		varying vec2 vUv;

		#include <packing>

		float getDepth( const in vec2 screenPosition ) {

			return texture2D( tDepth, screenPosition ).x;

		}

		float getLinearDepth( const in vec2 screenPosition ) {

			#if PERSPECTIVE_CAMERA == 1

				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );

			#else

				return texture2D( tDepth, screenPosition ).x;

			#endif

		}

		float getViewZ( const in float depth ) {

			#if PERSPECTIVE_CAMERA == 1

				return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );

			#else

				return orthographicDepthToViewZ( depth, cameraNear, cameraFar );

			#endif

		}

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {

			float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];

			vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );

			clipPosition *= clipW; // unprojection.

			return ( cameraInverseProjectionMatrix * clipPosition ).xyz;

		}

		vec3 getViewNormal( const in vec2 screenPosition ) {

			return unpackRGBToNormal( texture2D( tNormal, screenPosition ).xyz );

		}

		void main() {

			float depth = getDepth( vUv );

			if ( depth == 1.0 ) {

				gl_FragColor = vec4( 1.0 ); // don't influence background

			} else {

				float viewZ = getViewZ( depth );

				vec3 viewPosition = getViewPosition( vUv, depth, viewZ );
				vec3 viewNormal = getViewNormal( vUv );

				vec2 noiseScale = vec2( resolution.x / 4.0, resolution.y / 4.0 );
				vec3 random = vec3( texture2D( tNoise, vUv * noiseScale ).r );

				// compute matrix used to reorient a kernel vector

				vec3 tangent = normalize( random - viewNormal * dot( random, viewNormal ) );
				vec3 bitangent = cross( viewNormal, tangent );
				mat3 kernelMatrix = mat3( tangent, bitangent, viewNormal );

				float occlusion = 0.0;

				for ( int i = 0; i < KERNEL_SIZE; i ++ ) {

					vec3 sampleVector = kernelMatrix * kernel[ i ]; // reorient sample vector in view space
					vec3 samplePoint = viewPosition + ( sampleVector * kernelRadius ); // calculate sample point

					vec4 samplePointNDC = cameraProjectionMatrix * vec4( samplePoint, 1.0 ); // project point and calculate NDC
					samplePointNDC /= samplePointNDC.w;

					vec2 samplePointUv = samplePointNDC.xy * 0.5 + 0.5; // compute uv coordinates

					float realDepth = getLinearDepth( samplePointUv ); // get linear depth from depth texture
					float sampleDepth = viewZToOrthographicDepth( samplePoint.z, cameraNear, cameraFar ); // compute linear depth of the sample view Z value
					float delta = sampleDepth - realDepth;

					if ( delta > minDistance && delta < maxDistance ) { // if fragment is before sample point, increase occlusion

						occlusion += 1.0;

					}

				}

				occlusion = clamp( occlusion / float( KERNEL_SIZE ), 0.0, 1.0 );

				gl_FragColor = vec4( vec3( 1.0 - occlusion ), 1.0 );

			}

		}`},l={name:"SSAODepthShader",defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`uniform sampler2D tDepth;

		uniform float cameraNear;
		uniform float cameraFar;

		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {

			#if PERSPECTIVE_CAMERA == 1

				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );

			#else

				return texture2D( tDepth, screenPosition ).x;

			#endif

		}

		void main() {

			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`},o={name:"SSAOBlurShader",uniforms:{tDiffuse:{value:null},resolution:{value:new a.I9Y}},vertexShader:`varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`uniform sampler2D tDiffuse;

		uniform vec2 resolution;

		varying vec2 vUv;

		void main() {

			vec2 texelSize = ( 1.0 / resolution );
			float result = 0.0;

			for ( int i = - 2; i <= 2; i ++ ) {

				for ( int j = - 2; j <= 2; j ++ ) {

					vec2 offset = ( vec2( float( i ), float( j ) ) ) * texelSize;
					result += texture2D( tDiffuse, vUv + offset ).r;

				}

			}

			gl_FragColor = vec4( vec3( result / ( 5.0 * 5.0 ) ), 1.0 );

		}`};var h=i(52049);class u extends r.o{constructor(e,t,i=512,s=512,u=32){super(),this.width=i,this.height=s,this.clear=!0,this.needsSwap=!1,this.camera=t,this.scene=e,this.kernelRadius=8,this.kernel=[],this.noiseTexture=null,this.output=0,this.minDistance=.005,this.maxDistance=.1,this._visibilityCache=[],this._generateSampleKernel(u),this._generateRandomKernelRotations();let d=new a.VCu;d.format=a.dcC,d.type=a.V3x,this.normalRenderTarget=new a.nWS(this.width,this.height,{minFilter:a.hxR,magFilter:a.hxR,type:a.ix0,depthTexture:d}),this.ssaoRenderTarget=new a.nWS(this.width,this.height,{type:a.ix0}),this.blurRenderTarget=this.ssaoRenderTarget.clone(),this.ssaoMaterial=new a.BKk({defines:Object.assign({},n.defines),uniforms:a.LlO.clone(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,blending:a.XIg}),this.ssaoMaterial.defines.KERNEL_SIZE=u,this.ssaoMaterial.uniforms.tNormal.value=this.normalRenderTarget.texture,this.ssaoMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture,this.ssaoMaterial.uniforms.tNoise.value=this.noiseTexture,this.ssaoMaterial.uniforms.kernel.value=this.kernel,this.ssaoMaterial.uniforms.cameraNear.value=this.camera.near,this.ssaoMaterial.uniforms.cameraFar.value=this.camera.far,this.ssaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse),this.normalMaterial=new a.qBx,this.normalMaterial.blending=a.XIg,this.blurMaterial=new a.BKk({defines:Object.assign({},o.defines),uniforms:a.LlO.clone(o.uniforms),vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.blurMaterial.uniforms.tDiffuse.value=this.ssaoRenderTarget.texture,this.blurMaterial.uniforms.resolution.value.set(this.width,this.height),this.depthRenderMaterial=new a.BKk({defines:Object.assign({},l.defines),uniforms:a.LlO.clone(l.uniforms),vertexShader:l.vertexShader,fragmentShader:l.fragmentShader,blending:a.XIg}),this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture,this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new a.BKk({uniforms:a.LlO.clone(h.Z.uniforms),vertexShader:h.Z.vertexShader,fragmentShader:h.Z.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:a.wn6,blendDst:a.ojh,blendEquation:a.gO9,blendSrcAlpha:a.hdd,blendDstAlpha:a.ojh,blendEquationAlpha:a.gO9}),this._fsQuad=new r.F(null),this._originalClearColor=new a.Q1f}dispose(){this.normalRenderTarget.dispose(),this.ssaoRenderTarget.dispose(),this.blurRenderTarget.dispose(),this.normalMaterial.dispose(),this.blurMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this._fsQuad.dispose()}render(e,t,i){switch(this._overrideVisibility(),this._renderOverride(e,this.normalMaterial,this.normalRenderTarget,7829503,1),this._restoreVisibility(),this.ssaoMaterial.uniforms.kernelRadius.value=this.kernelRadius,this.ssaoMaterial.uniforms.minDistance.value=this.minDistance,this.ssaoMaterial.uniforms.maxDistance.value=this.maxDistance,this._renderPass(e,this.ssaoMaterial,this.ssaoRenderTarget),this._renderPass(e,this.blurMaterial,this.blurRenderTarget),this.output){case u.OUTPUT.SSAO:this.copyMaterial.uniforms.tDiffuse.value=this.ssaoRenderTarget.texture,this.copyMaterial.blending=a.XIg,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:i);break;case u.OUTPUT.Blur:this.copyMaterial.uniforms.tDiffuse.value=this.blurRenderTarget.texture,this.copyMaterial.blending=a.XIg,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:i);break;case u.OUTPUT.Depth:this._renderPass(e,this.depthRenderMaterial,this.renderToScreen?null:i);break;case u.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=a.XIg,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:i);break;case u.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=this.blurRenderTarget.texture,this.copyMaterial.blending=a.bCz,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:i);break;default:console.warn("THREE.SSAOPass: Unknown output type.")}}setSize(e,t){this.width=e,this.height=t,this.ssaoRenderTarget.setSize(e,t),this.normalRenderTarget.setSize(e,t),this.blurRenderTarget.setSize(e,t),this.ssaoMaterial.uniforms.resolution.value.set(e,t),this.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse),this.blurMaterial.uniforms.resolution.value.set(e,t)}_renderPass(e,t,i,a,r){e.getClearColor(this._originalClearColor);let s=e.getClearAlpha(),n=e.autoClear;e.setRenderTarget(i),e.autoClear=!1,null!=a&&(e.setClearColor(a),e.setClearAlpha(r||0),e.clear()),this._fsQuad.material=t,this._fsQuad.render(e),e.autoClear=n,e.setClearColor(this._originalClearColor),e.setClearAlpha(s)}_renderOverride(e,t,i,a,r){e.getClearColor(this._originalClearColor);let s=e.getClearAlpha(),n=e.autoClear;e.setRenderTarget(i),e.autoClear=!1,a=t.clearColor||a,r=t.clearAlpha||r,null!=a&&(e.setClearColor(a),e.setClearAlpha(r||0),e.clear()),this.scene.overrideMaterial=t,e.render(this.scene,this.camera),this.scene.overrideMaterial=null,e.autoClear=n,e.setClearColor(this._originalClearColor),e.setClearAlpha(s)}_generateSampleKernel(e){let t=this.kernel;for(let i=0;i<e;i++){let r=new a.Pq0;r.x=2*Math.random()-1,r.y=2*Math.random()-1,r.z=Math.random(),r.normalize();let s=i/e;s=a.cj9.lerp(.1,1,s*s),r.multiplyScalar(s),t.push(r)}}_generateRandomKernelRotations(){let e=new s,t=new Float32Array(16);for(let i=0;i<16;i++){let a=2*Math.random()-1,r=2*Math.random()-1;t[i]=e.noise3d(a,r,0)}this.noiseTexture=new a.GYF(t,4,4,a.VT0,a.RQf),this.noiseTexture.wrapS=a.GJx,this.noiseTexture.wrapT=a.GJx,this.noiseTexture.needsUpdate=!0}_overrideVisibility(){let e=this.scene,t=this._visibilityCache;e.traverse(function(e){(e.isPoints||e.isLine||e.isLine2)&&e.visible&&(e.visible=!1,t.push(e))})}_restoreVisibility(){let e=this._visibilityCache;for(let t=0;t<e.length;t++)e[t].visible=!0;e.length=0}}u.OUTPUT={Default:0,SSAO:1,Blur:2,Depth:3,Normal:4}},94497:(e,t,i)=>{i.d(t,{s:()=>h});var a=i(85339),r=i(52049),s=i(23264),n=i(63617);class l extends n.o{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,i){let a,r,s=e.getContext(),n=e.state;n.buffers.color.setMask(!1),n.buffers.depth.setMask(!1),n.buffers.color.setLocked(!0),n.buffers.depth.setLocked(!0),this.inverse?(a=0,r=1):(a=1,r=0),n.buffers.stencil.setTest(!0),n.buffers.stencil.setOp(s.REPLACE,s.REPLACE,s.REPLACE),n.buffers.stencil.setFunc(s.ALWAYS,a,0xffffffff),n.buffers.stencil.setClear(r),n.buffers.stencil.setLocked(!0),e.setRenderTarget(i),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),n.buffers.color.setLocked(!1),n.buffers.depth.setLocked(!1),n.buffers.color.setMask(!0),n.buffers.depth.setMask(!0),n.buffers.stencil.setLocked(!1),n.buffers.stencil.setFunc(s.EQUAL,1,0xffffffff),n.buffers.stencil.setOp(s.KEEP,s.KEEP,s.KEEP),n.buffers.stencil.setLocked(!0)}}class o extends n.o{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class h{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),void 0===t){let i=e.getSize(new a.I9Y);this._width=i.width,this._height=i.height,(t=new a.nWS(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:a.ix0})).texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new s.p(r.Z),this.copyPass.material.blending=a.XIg,this.clock=new a.zD7}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);-1!==t&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){void 0===e&&(e=this.clock.getDelta());let t=this.renderer.getRenderTarget(),i=!1;for(let t=0,a=this.passes.length;t<a;t++){let a=this.passes[t];if(!1!==a.enabled){if(a.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),a.render(this.renderer,this.writeBuffer,this.readBuffer,e,i),a.needsSwap){if(i){let t=this.renderer.getContext(),i=this.renderer.state.buffers.stencil;i.setFunc(t.NOTEQUAL,1,0xffffffff),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),i.setFunc(t.EQUAL,1,0xffffffff)}this.swapBuffers()}void 0!==l&&(a instanceof l?i=!0:a instanceof o&&(i=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(void 0===e){let t=this.renderer.getSize(new a.I9Y);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,(e=this.renderTarget1.clone()).setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let i=this._width*this._pixelRatio,a=this._height*this._pixelRatio;this.renderTarget1.setSize(i,a),this.renderTarget2.setSize(i,a);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(i,a)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}},96319:(e,t,i)=>{i.d(t,{l:()=>r});var a=i(85339);class r extends a.Z58{constructor(){super();let e=new a.iNn;e.deleteAttribute("uv");let t=new a._4j({side:a.hsX}),i=new a._4j,r=new a.HiM(0xffffff,900,28,2);r.position.set(.418,16.199,.3),this.add(r);let n=new a.eaF(e,t);n.position.set(-.757,13.219,.717),n.scale.set(31.713,28.305,28.591),this.add(n);let l=new a.ZLX(e,i,6),o=new a.B69;o.position.set(-10.906,2.009,1.846),o.rotation.set(0,-.195,0),o.scale.set(2.328,7.905,4.651),o.updateMatrix(),l.setMatrixAt(0,o.matrix),o.position.set(-5.607,-.754,-.758),o.rotation.set(0,.994,0),o.scale.set(1.97,1.534,3.955),o.updateMatrix(),l.setMatrixAt(1,o.matrix),o.position.set(6.167,.857,7.803),o.rotation.set(0,.561,0),o.scale.set(3.927,6.285,3.687),o.updateMatrix(),l.setMatrixAt(2,o.matrix),o.position.set(-2.017,.018,6.124),o.rotation.set(0,.333,0),o.scale.set(2.002,4.566,2.064),o.updateMatrix(),l.setMatrixAt(3,o.matrix),o.position.set(2.291,-.756,-2.621),o.rotation.set(0,-.286,0),o.scale.set(1.546,1.552,1.496),o.updateMatrix(),l.setMatrixAt(4,o.matrix),o.position.set(-2.193,-.369,-5.547),o.rotation.set(0,.516,0),o.scale.set(3.875,3.487,2.986),o.updateMatrix(),l.setMatrixAt(5,o.matrix),this.add(l);let h=new a.eaF(e,s(50));h.position.set(-16.116,14.37,8.208),h.scale.set(.1,2.428,2.739),this.add(h);let u=new a.eaF(e,s(50));u.position.set(-16.109,18.021,-8.207),u.scale.set(.1,2.425,2.751),this.add(u);let d=new a.eaF(e,s(17));d.position.set(14.904,12.198,-1.832),d.scale.set(.15,4.265,6.331),this.add(d);let c=new a.eaF(e,s(43));c.position.set(-.462,8.89,14.52),c.scale.set(4.38,5.441,.088),this.add(c);let p=new a.eaF(e,s(20));p.position.set(3.235,11.486,-12.541),p.scale.set(2.5,2,.1),this.add(p);let f=new a.eaF(e,s(100));f.position.set(0,20,0),f.scale.set(1,.1,1),this.add(f)}dispose(){let e=new Set;for(let t of(this.traverse(t=>{t.isMesh&&(e.add(t.geometry),e.add(t.material))}),e))t.dispose()}}function s(e){return new a.G_z({color:0,emissive:0xffffff,emissiveIntensity:e})}}}]);
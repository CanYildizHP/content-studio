import { Thumbnail } from '@/components/thumbnail/Thumbnail';
import { paramsToProps } from '@/components/thumbnail/thumbnail-params';

// Chrome-free render target for the Playwright capture. Strips the app shell via
// an inline <style>, renders only <Thumbnail>, and flags #thumb[data-ready="1"]
// once fonts + the portrait image have settled so the screenshot is deterministic.

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

export default async function RenderPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const k of Object.keys(sp)) {
    const v = sp[k];
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  const props = paramsToProps(flat);

  return (
    <>
      <style>{`
        .app__nav { display: none !important; }
        .app, .app__main { display: block !important; padding: 0 !important; }
        body { background: #000 !important; }
        #render-stage { width: 1200px; height: 630px; }
      `}</style>
      <div id="render-stage">
        <Thumbnail {...props} />
      </div>
      <script
        dangerouslySetInnerHTML={{
          // Signal readiness via a window flag (NOT a DOM attribute on the
          // React-managed #thumb), so we don't cause a hydration mismatch.
          __html: `(function(){
            function flag(){ window.__thumbReady = true; }
            var imgs = Array.prototype.slice.call(document.images || []);
            var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
            var decoded = Promise.all(imgs.map(function(im){
              try { return im.decode ? im.decode().catch(function(){}) : Promise.resolve(); }
              catch(e){ return Promise.resolve(); }
            }));
            Promise.all([fonts, decoded]).then(function(){
              requestAnimationFrame(function(){ requestAnimationFrame(flag); });
            });
            setTimeout(flag, 4000); // safety net
          })();`,
        }}
      />
    </>
  );
}

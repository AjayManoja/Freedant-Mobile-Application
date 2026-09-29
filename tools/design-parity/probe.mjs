// Loads an app route and prints visible text plus console errors/exceptions.
import { openPage } from './cdp.mjs';
const [route = '/', wait = '20000'] = process.argv.slice(2);
const p = await openPage({ port: 9226 });
try {
  await p.go('http://localhost:8081/', 1500);
  await p.eval(`localStorage.setItem('feedants.onboarded','1')`);
  await p.go('http://localhost:8081' + route, Number(wait));
  console.log('TEXT:', (await p.eval('document.body.innerText')).slice(0, 600).replace(/\n+/g, ' | '));
  for (const e of p.events) {
    if (e.method === 'Runtime.exceptionThrown')
      console.log('EXCEPTION:', e.params.exceptionDetails.exception?.description?.slice(0, 800));
    if (e.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(e.params.type))
      console.log(
        e.params.type.toUpperCase() + ':',
        e.params.args
          .map((a) => a.value ?? a.description)
          .join(' ')
          .slice(0, 800),
      );
  }
} finally {
  p.close();
}

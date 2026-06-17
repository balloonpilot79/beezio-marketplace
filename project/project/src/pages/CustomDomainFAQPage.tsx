import React from 'react';
import { AlertCircle, CheckCircle, Clock, Copy, ExternalLink, Globe, HelpCircle } from 'lucide-react';

const DNS_TARGET = 'beezio-marketplace.netlify.app';
const ROOT_IP = '104.198.14.52';

const CustomDomainFAQPage: React.FC = () => {
  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="flex items-center gap-3 text-emerald-700">
            <Globe className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase">Custom Site Domains</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-gray-950">Connect a domain to your custom site</h1>
          <p className="mt-3 max-w-3xl text-gray-700">
            Use this guide when you want your Beezio custom site to load from your own domain, like mystore.com or shop.mystore.com.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-5">
            <h2 className="text-xl font-semibold text-gray-950">Before You Start</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <p>You need access to the domain provider where your domain DNS is managed.</p>
              <p>Examples include GoDaddy, Namecheap, Cloudflare, Squarespace, Wix, Google Domains, or your web host.</p>
              <p>Enter only the domain name in Beezio. Do not include https://, http://, or a page path.</p>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <h2 className="text-xl font-semibold text-gray-950">Step-by-Step Setup</h2>
            <ol className="mt-4 space-y-3 text-sm text-gray-700">
              <li>1. Open your Custom Site dashboard.</li>
              <li>2. Go to the Domain & Links tab.</li>
              <li>3. Type your domain, such as mystore.com or shop.mystore.com.</li>
              <li>4. Click Save.</li>
              <li>5. Open DNS settings at your domain provider.</li>
              <li>6. Add the DNS record shown below.</li>
              <li>7. Wait for DNS to update, then return to Beezio and click Re-check now.</li>
            </ol>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <h2 className="text-xl font-semibold text-gray-950">DNS Records</h2>
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900">Root domain</h3>
                <p className="mt-1 text-sm text-gray-600">Use this for mystore.com.</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="text-gray-600">
                      <tr>
                        <th className="border-b py-2">Type</th>
                        <th className="border-b py-2">Name</th>
                        <th className="border-b py-2">Value</th>
                        <th className="border-b py-2">TTL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-2 font-mono">A</td>
                        <td className="py-2 font-mono">@</td>
                        <td className="py-2 font-mono">{ROOT_IP}</td>
                        <td className="py-2 font-mono">Auto or 3600</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-mono">CNAME</td>
                        <td className="py-2 font-mono">www</td>
                        <td className="py-2 font-mono">{DNS_TARGET}</td>
                        <td className="py-2 font-mono">Auto or 3600</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900">Subdomain</h3>
                <p className="mt-1 text-sm text-gray-600">Use this for shop.mystore.com.</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="text-gray-600">
                      <tr>
                        <th className="border-b py-2">Type</th>
                        <th className="border-b py-2">Name</th>
                        <th className="border-b py-2">Value</th>
                        <th className="border-b py-2">TTL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-2 font-mono">CNAME</td>
                        <td className="py-2 font-mono">shop</td>
                        <td className="py-2 font-mono">{DNS_TARGET}</td>
                        <td className="py-2 font-mono">Auto or 3600</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <h2 className="text-xl font-semibold text-gray-950">Fix Common Issues</h2>
            <div className="mt-4 space-y-4 text-sm text-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900">Beezio says DNS is not detected yet</h3>
                <p>Wait 5-30 minutes and try Re-check now again. Some providers can take up to 48 hours.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">The domain still opens an old website</h3>
                <p>Remove old A, AAAA, or CNAME records for the same host. A host should not point to two different services.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">The provider will not accept @</h3>
                <p>Some providers use blank, root, or the domain name itself instead of @.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">SSL or HTTPS is not ready</h3>
                <p>SSL starts after DNS points correctly. If DNS is correct, give it time and re-check later.</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-950">Quick Copy</h2>
            <div className="mt-4 space-y-3">
              <button
                onClick={() => copy(ROOT_IP)}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-mono">{ROOT_IP}</span>
                <Copy className="h-4 w-4 text-gray-500" />
              </button>
              <button
                onClick={() => copy(DNS_TARGET)}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-mono">{DNS_TARGET}</span>
                <Copy className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 text-green-700" />
              <div>
                <h2 className="font-semibold text-green-950">Use the Beezio link anytime</h2>
                <p className="mt-1 text-sm text-green-800">
                  Your beezio.co/store link keeps working even while your custom domain is updating.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <h2 className="font-semibold text-blue-950">DNS takes time</h2>
                <p className="mt-1 text-sm text-blue-800">
                  Most changes show up in under 30 minutes, but a provider can take longer.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-700" />
              <div>
                <h2 className="font-semibold text-yellow-950">Do not add secrets</h2>
                <p className="mt-1 text-sm text-yellow-800">
                  DNS setup does not require PayPal, Supabase, or Beezio account keys.
                </p>
              </div>
            </div>
          </div>

          <a
            href="/contact-support"
            className="flex items-center justify-between rounded-lg border bg-white p-5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            <span className="inline-flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-gray-600" />
              Contact support
            </span>
            <ExternalLink className="h-4 w-4 text-gray-500" />
          </a>
        </aside>
      </section>
    </main>
  );
};

export default CustomDomainFAQPage;

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PublicLayout from '../components/layout/PublicLayout';
import { SAMPLE_FUNDRAISERS } from '../lib/sampleFundraisers';
import { supabase } from '../lib/supabase';

type Fundraiser = typeof SAMPLE_FUNDRAISERS[number];

const FundraisersPage: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Fundraiser[]>(SAMPLE_FUNDRAISERS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadFundraisers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('causes')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data && data.length) {
          setCampaigns(data as Fundraiser[]);
        }
      } catch (err) {
        console.warn('FundraisersPage: using sample fundraisers', err);
      } finally {
        setLoading(false);
      }
    };

    loadFundraisers();
  }, []);

  const progressFor = (campaign: Fundraiser) => {
    const goal = campaign.goal_amount || 0;
    const raised = campaign.raised_amount || 0;
    if (!goal) return 0;
    return Math.min(100, Math.round((raised / goal) * 100));
  };

  return (
    <PublicLayout>
      <section className="space-y-4">
        <p className="text-sm text-amber-700 font-semibold uppercase tracking-[0.2em]">Fundraisers</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-900">Fundraisers in progress</h1>
          <p className="text-gray-700">
            Beezio adds a 5% referral share plus affiliate commissions so more supporters help causes reach their goals.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/dashboard/fundraiser')}
            className="inline-flex items-center px-5 py-3 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-600 transition-colors"
          >
            Start a fundraiser
          </button>
          <Link
            to="/marketplace"
            className="inline-flex items-center px-5 py-3 rounded-full border border-gray-300 text-gray-900 font-semibold hover:border-amber-500 hover:text-amber-700 transition-colors"
          >
            Browse products to feature
          </Link>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        {loading ? (
          <p className="text-gray-700">Loading active campaigns…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-gray-700">No fundraisers are live yet. Launch one from the fundraiser dashboard.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((campaign) => {
              const progress = progressFor(campaign);
              return (
                <div
                  key={campaign.id}
                  className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <img
                    src={campaign.image_url}
                    alt={campaign.title}
                    className="w-full h-52 object-cover"
                  />
                  <div className="p-5 space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-xl font-semibold text-gray-900">{campaign.title}</h3>
                      <p className="text-sm text-gray-600">by {campaign.creator_name}</p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{campaign.story}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                        <span>${(campaign.raised_amount || 0).toLocaleString()}</span>
                        <span>{progress}% of ${(campaign.goal_amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="h-3 rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-gray-600">
                        Supporters earn affiliate rewards; referrers share 5% of Beezio's cut.
                      </span>
                      <Link
                        to={`/fundraiser/${campaign.id}`}
                        className="inline-flex items-center gap-2 text-amber-700 font-semibold hover:text-amber-800"
                      >
                        View fundraiser
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PublicLayout>
  );
};

export default FundraisersPage;

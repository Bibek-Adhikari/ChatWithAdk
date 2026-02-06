import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { adminService } from '../services/adminService';

// Types
interface PlanFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  icon?: string;
}

interface PricingTier {
  monthly: number;
  yearly: number;
  discount?: number; // percentage off for yearly
}

interface ProPlan {
  id: string;
  name: string;
  description: string;
  tier: 'basic' | 'pro' | 'enterprise' | 'custom';
  pricing: PricingTier;
  features: PlanFeature[];
  limits: {
    messagesPerDay: number;
    storageGB: number;
    maxChatHistory: number;
    apiAccess: boolean;
    customModels: boolean;
    prioritySupport: boolean;
    teamMembers?: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  color: string;
  icon: string;
  trialDays: number;
}

interface UserPlan {
  userId: string;
  userEmail: string;
  userName: string;
  planId: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  startedAt: string;
  expiresAt: string | null;
  paymentMethod: string;
  totalSpent: number;
}

const ADMIN_EMAILS = ['crazybibek4444@gmail.com', 'geniusbibek4444@gmail.com'];

// Default plan template
const defaultPlan: Omit<ProPlan, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  tier: 'pro',
  pricing: { monthly: 9.99, yearly: 99.99, discount: 15 },
  features: [
    { id: '1', name: 'Unlimited Messages', description: 'Send unlimited messages per day', included: true, icon: 'fa-infinity' },
    { id: '2', name: 'Priority Response', description: 'Faster AI response times', included: true, icon: 'fa-bolt' },
    { id: '3', name: 'Advanced Models', description: 'Access to GPT-4, Claude 3, etc.', included: true, icon: 'fa-brain' },
  ],
  limits: {
    messagesPerDay: -1, // -1 = unlimited
    storageGB: 10,
    maxChatHistory: 100,
    apiAccess: false,
    customModels: false,
    prioritySupport: true,
    teamMembers: 1,
  },
  isActive: true,
  color: 'blue',
  icon: 'fa-crown',
  trialDays: 7,
};

const availableIcons = [
  'fa-crown', 'fa-gem', 'fa-rocket', 'fa-briefcase', 'fa-building', 
  'fa-star', 'fa-trophy', 'fa-medal', 'fa-shield-alt', 'fa-zap'
];

const colorThemes = [
  { name: 'Blue', value: 'blue', gradient: 'from-blue-500 to-indigo-600' },
  { name: 'Purple', value: 'purple', gradient: 'from-purple-500 to-pink-600' },
  { name: 'Emerald', value: 'emerald', gradient: 'from-emerald-500 to-teal-600' },
  { name: 'Orange', value: 'orange', gradient: 'from-orange-500 to-red-600' },
  { name: 'Rose', value: 'rose', gradient: 'from-rose-500 to-pink-600' },
];

const Plans: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ProPlan[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<UserPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProPlan | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPlanForAssign, setSelectedPlanForAssign] = useState<ProPlan | null>(null);
  
  // Form state
  const [formData, setFormData] = useState(defaultPlan);
  
  // Stats
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeSubscribers: 0,
    churnRate: 0,
    mrr: 0,
  });

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser?.email || !ADMIN_EMAILS.includes(currentUser.email)) {
        setError("Unauthorized: Admin access required");
        setLoading(false);
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      try {
        // Mock data - replace with actual API calls
        const mockPlans: ProPlan[] = [
          {
            id: 'pro-basic',
            name: 'Pro Basic',
            description: 'Essential features for power users',
            tier: 'pro',
            pricing: { monthly: 9.99, yearly: 99.99, discount: 17 },
            features: [
              { id: '1', name: 'Unlimited Messages', description: 'No daily limits', included: true, icon: 'fa-infinity' },
              { id: '2', name: 'Priority Support', description: 'Email support within 24h', included: true, icon: 'fa-headset' },
              { id: '3', name: 'Advanced Models', description: 'GPT-4 access', included: true, icon: 'fa-brain' },
              { id: '4', name: 'API Access', description: 'REST API access', included: false, icon: 'fa-code' },
            ],
            limits: { messagesPerDay: -1, storageGB: 10, maxChatHistory: 100, apiAccess: false, customModels: false, prioritySupport: true, teamMembers: 1 },
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            color: 'blue',
            icon: 'fa-rocket',
            trialDays: 7,
          },
          {
            id: 'pro-enterprise',
            name: 'Enterprise',
            description: 'For teams and businesses',
            tier: 'enterprise',
            pricing: { monthly: 49.99, yearly: 499.99, discount: 17 },
            features: [
              { id: '1', name: 'Everything in Pro', description: 'All Pro features included', included: true, icon: 'fa-check' },
              { id: '2', name: 'API Access', description: 'Full REST API', included: true, icon: 'fa-code' },
              { id: '3', name: 'Custom Models', description: 'Fine-tuned models', included: true, icon: 'fa-sliders-h' },
              { id: '4', name: 'Team Collaboration', description: 'Up to 10 members', included: true, icon: 'fa-users' },
              { id: '5', name: 'Dedicated Support', description: '24/7 phone support', included: true, icon: 'fa-phone' },
            ],
            limits: { messagesPerDay: -1, storageGB: 100, maxChatHistory: 1000, apiAccess: true, customModels: true, prioritySupport: true, teamMembers: 10 },
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            color: 'purple',
            icon: 'fa-building',
            trialDays: 14,
          },
        ];

        const mockUsers: UserPlan[] = [
          {
            userId: 'user1',
            userEmail: 'john@example.com',
            userName: 'John Doe',
            planId: 'pro-basic',
            status: 'active',
            startedAt: '2024-01-15',
            expiresAt: '2025-01-15',
            paymentMethod: 'card_ending_4242',
            totalSpent: 99.99,
          },
          {
            userId: 'user2',
            userEmail: 'jane@example.com',
            userName: 'Jane Smith',
            planId: 'pro-enterprise',
            status: 'trialing',
            startedAt: '2024-02-01',
            expiresAt: null,
            paymentMethod: 'paypal',
            totalSpent: 0,
          },
        ];

        setPlans(mockPlans);
        setUserSubscriptions(mockUsers);
        setStats({
          totalRevenue: 15499.50,
          activeSubscribers: 234,
          churnRate: 4.2,
          mrr: 3890.00,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkAdminAndFetch();
  }, [navigate]);

  const handleSavePlan = async () => {
    const planData: ProPlan = {
      ...formData,
      id: editingPlan?.id || `plan_${Date.now()}`,
      createdAt: editingPlan?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingPlan) {
      setPlans(plans.map(p => p.id === editingPlan.id ? planData : p));
    } else {
      setPlans([...plans, planData]);
    }
    
    setShowPlanModal(false);
    setEditingPlan(null);
    setFormData(defaultPlan);
  };

  const handleDeletePlan = (planId: string) => {
    if (confirm('Are you sure? This will affect active subscribers.')) {
      setPlans(plans.filter(p => p.id !== planId));
    }
  };

  const handleTogglePlanStatus = (planId: string) => {
    setPlans(plans.map(p => 
      p.id === planId ? { ...p, isActive: !p.isActive } : p
    ));
  };

  const openEditModal = (plan: ProPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      tier: plan.tier,
      pricing: plan.pricing,
      features: plan.features,
      limits: plan.limits,
      isActive: plan.isActive,
      color: plan.color,
      icon: plan.icon,
      trialDays: plan.trialDays,
    });
    setShowPlanModal(true);
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormData(defaultPlan);
    setShowPlanModal(true);
  };

  const addFeature = () => {
    setFormData({
      ...formData,
      features: [
        ...formData.features,
        {
          id: `feat_${Date.now()}`,
          name: 'New Feature',
          description: 'Feature description',
          included: true,
          icon: 'fa-check',
        },
      ],
    });
  };

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index),
    });
  };

  const updateFeature = (index: number, field: keyof PlanFeature, value: any) => {
    const updated = [...formData.features];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, features: updated });
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/30 border-t-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 sm:p-8 ${theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4">
          <div>
            <button 
              onClick={() => navigate('/?admin=true')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest mb-4 transition-all
                ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}>
              <i className="fas fa-arrow-left" /> Back to Admin
            </button>
            <h1 className={`text-3xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Pro Plans Management
            </h1>
            <p className="text-slate-500 mt-1">Configure pricing, features, and monitor subscriptions</p>
          </div>
          
          <button 
            onClick={openCreateModal}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-blue-500/20 flex items-center gap-2">
            <i className="fas fa-plus" /> Create New Plan
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard theme={theme} label="Monthly Recurring Revenue" value={`$${stats.mrr.toLocaleString()}`} change="+12.5%" positive color="emerald" />
          <StatCard theme={theme} label="Active Subscribers" value={stats.activeSubscribers.toString()} change="+8.2%" positive color="blue" />
          <StatCard theme={theme} label="Total Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} change="+23.1%" positive color="purple" />
          <StatCard theme={theme} label="Churn Rate" value={`${stats.churnRate}%`} change="-0.5%" positive color="orange" />
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => (
            <div key={plan.id} className={`relative group rounded-[32px] overflow-hidden border transition-all hover:scale-[1.02]
              ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} shadow-xl`}>
              
              {/* Plan Header */}
              <div className={`p-8 bg-gradient-to-br ${colorThemes.find(c => c.value === plan.color)?.gradient || 'from-blue-500 to-indigo-600'} relative overflow-hidden`}>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMzAgMEw2MCAzMEwzMCA2MEwwIDMwTDMwIDB6IiBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjEiLz48L3N2Zz4=')] opacity-30" />
                
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white">
                        <i className={`fas ${plan.icon}`} />
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur`}>
                        {plan.tier}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-1">{plan.name}</h3>
                    <p className="text-white/80 text-sm">{plan.description}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => openEditModal(plan)}
                      className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all backdrop-blur">
                      <i className="fas fa-edit" />
                    </button>
                    <button 
                      onClick={() => handleDeletePlan(plan.id)}
                      className="w-10 h-10 rounded-xl bg-white/20 hover:bg-red-500/80 text-white flex items-center justify-center transition-all backdrop-blur">
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>

                <div className="relative mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">${plan.pricing.monthly}</span>
                  <span className="text-white/60 text-sm font-bold">/month</span>
                </div>
              </div>

              {/* Plan Details */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-500 line-through">${plan.pricing.yearly}</span>
                    <span className="text-sm font-black text-emerald-500">/year</span>
                    {plan.pricing.discount && (
                      <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] font-black">
                        Save {plan.pricing.discount}%
                      </span>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => handleTogglePlanStatus(plan.id)}
                    className={`relative w-12 h-6 rounded-full transition-all ${plan.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${plan.isActive ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {/* Features List */}
                <div className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <div key={feature.id} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0
                        ${feature.included 
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                        <i className={`fas ${feature.included ? 'fa-check' : 'fa-times'} text-xs`} />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${feature.included ? '' : 'text-slate-400 line-through'}`}>
                          {feature.name}
                        </p>
                        <p className="text-[11px] text-slate-500">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Limits */}
                <div className={`p-4 rounded-2xl border mb-4 ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Plan Limits</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Messages/Day</span>
                      <span className="font-black">{plan.limits.messagesPerDay === -1 ? '∞' : plan.limits.messagesPerDay}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Storage</span>
                      <span className="font-black">{plan.limits.storageGB} GB</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">History</span>
                      <span className="font-black">{plan.limits.maxChatHistory} chats</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Team</span>
                      <span className="font-black">{plan.limits.teamMembers} members</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setSelectedPlanForAssign(plan); setShowAssignModal(true); }}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95
                      ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}>
                    <i className="fas fa-user-plus mr-2" /> Assign User
                  </button>
                  <button className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95">
                    Preview
                  </button>
                </div>
              </div>

              {/* Status Badge */}
              {!plan.isActive && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-[32px]">
                  <div className="px-6 py-3 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-500 font-black text-sm uppercase tracking-widest">
                    <i className="fas fa-ban mr-2" /> Disabled
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Active Subscriptions Table */}
        <div className={`rounded-[32px] border overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} shadow-xl`}>
          <div className="p-6 border-b border-slate-200 dark:border-white/10">
            <h3 className="text-lg font-black">Active Subscriptions</h3>
            <p className="text-sm text-slate-500 mt-1">{userSubscriptions.length} users currently subscribed</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'} border-b border-slate-200 dark:border-white/5`}>
                <tr className="text-left">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">User</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Plan</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Started</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Revenue</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {userSubscriptions.map((sub) => {
                  const plan = plans.find(p => p.id === sub.planId);
                  return (
                    <tr key={sub.userId} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm">
                            {sub.userName[0]}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{sub.userName}</p>
                            <p className="text-xs text-slate-500">{sub.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-black border
                          ${plan?.color === 'blue' ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : ''}
                          ${plan?.color === 'purple' ? 'bg-purple-500/10 border-purple-500/30 text-purple-500' : ''}
                          ${plan?.color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : ''}`}>
                          {plan?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider
                          ${sub.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : ''}
                          ${sub.status === 'trialing' ? 'bg-blue-500/10 text-blue-500' : ''}
                          ${sub.status === 'cancelled' ? 'bg-red-500/10 text-red-500' : ''}
                          ${sub.status === 'past_due' ? 'bg-orange-500/10 text-orange-500' : ''}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {new Date(sub.startedAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-sm font-black text-slate-800 dark:text-white">
                        ${sub.totalSpent.toFixed(2)}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 transition-colors">
                            <i className="fas fa-edit text-xs" />
                          </button>
                          <button className="w-8 h-8 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 flex items-center justify-center text-red-500 transition-colors">
                            <i className="fas fa-ban text-xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Plan Editor Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPlanModal(false)} />
          <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] shadow-2xl
            ${theme === 'dark' ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200'}`}>
            
            <div className="sticky top-0 p-6 border-b border-slate-200 dark:border-white/10 bg-inherit rounded-t-[32px] z-10 flex items-center justify-between">
              <h3 className="text-xl font-black">{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h3>
              <button onClick={() => setShowPlanModal(false)} className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors">
                <i className="fas fa-times" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Plan Name</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all
                      ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="e.g., Pro Premium"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all h-20
                      ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Short description of the plan..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Tier</label>
                  <select 
                    value={formData.tier}
                    onChange={e => setFormData({...formData, tier: e.target.value as any})}
                    className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all
                      ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Trial Days</label>
                  <input 
                    type="number" 
                    value={formData.trialDays}
                    onChange={e => setFormData({...formData, trialDays: parseInt(e.target.value) || 0})}
                    className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all
                      ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Pricing</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Monthly ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.pricing.monthly}
                      onChange={e => setFormData({...formData, pricing: {...formData.pricing, monthly: parseFloat(e.target.value) || 0}})}
                      className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50
                        ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Yearly ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.pricing.yearly}
                      onChange={e => setFormData({...formData, pricing: {...formData.pricing, yearly: parseFloat(e.target.value) || 0}})}
                      className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50
                        ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Yearly Discount (%)</label>
                    <input 
                      type="number" 
                      value={formData.pricing.discount || ''}
                      onChange={e => setFormData({...formData, pricing: {...formData.pricing, discount: parseInt(e.target.value) || undefined}})}
                      className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50
                        ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                </div>
              </div>

              {/* Appearance */}
              <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Appearance</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Color Theme</label>
                    <div className="flex gap-2 flex-wrap">
                      {colorThemes.map(color => (
                        <button
                          key={color.value}
                          onClick={() => setFormData({...formData, color: color.value})}
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color.gradient} transition-all
                            ${formData.color === color.value ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'opacity-60 hover:opacity-100'}`}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Icon</label>
                    <div className="flex gap-2 flex-wrap">
                      {availableIcons.map(icon => (
                        <button
                          key={icon}
                          onClick={() => setFormData({...formData, icon})}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all
                            ${formData.icon === icon 
                              ? 'bg-blue-500 text-white ring-2 ring-offset-2 ring-blue-500' 
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300'}`}>
                          <i className={`fas ${icon}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Features</h4>
                  <button 
                    onClick={addFeature}
                    className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 text-xs font-black hover:bg-blue-500/20 transition-colors">
                    <i className="fas fa-plus mr-1" /> Add Feature
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.features.map((feature, index) => (
                    <div key={feature.id} className={`p-4 rounded-xl border flex items-start gap-3
                      ${theme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-3 flex-1">
                        <input 
                          type="checkbox" 
                          checked={feature.included}
                          onChange={e => updateFeature(index, 'included', e.target.checked)}
                          className="w-5 h-5 rounded-lg border-2 border-slate-300 text-blue-500 focus:ring-blue-500"
                        />
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <input 
                            type="text" 
                            value={feature.name}
                            onChange={e => updateFeature(index, 'name', e.target.value)}
                            placeholder="Feature name"
                            className={`p-2 rounded-lg border text-sm
                              ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200'}`}
                          />
                          <input 
                            type="text" 
                            value={feature.description}
                            onChange={e => updateFeature(index, 'description', e.target.value)}
                            placeholder="Description"
                            className={`p-2 rounded-lg border text-sm
                              ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFeature(index)}
                        className="w-8 h-8 rounded-lg hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors">
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Limits */}
              <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Usage Limits</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Messages/Day (-1 for unlimited)</label>
                    <input 
                      type="number" 
                      value={formData.limits.messagesPerDay}
                      onChange={e => setFormData({...formData, limits: {...formData.limits, messagesPerDay: parseInt(e.target.value) || 0}})}
                      className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50
                        ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Storage (GB)</label>
                    <input 
                      type="number" 
                      value={formData.limits.storageGB}
                      onChange={e => setFormData({...formData, limits: {...formData.limits, storageGB: parseInt(e.target.value) || 0}})}
                      className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50
                        ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Max Chat History</label>
                    <input 
                      type="number" 
                      value={formData.limits.maxChatHistory}
                      onChange={e => setFormData({...formData, limits: {...formData.limits, maxChatHistory: parseInt(e.target.value) || 0}})}
                      className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50
                        ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Team Members</label>
                    <input 
                      type="number" 
                      value={formData.limits.teamMembers || 1}
                      onChange={e => setFormData({...formData, limits: {...formData.limits, teamMembers: parseInt(e.target.value) || 1}})}
                      className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50
                        ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                </div>
                
                <div className="mt-4 flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.limits.apiAccess}
                      onChange={e => setFormData({...formData, limits: {...formData.limits, apiAccess: e.target.checked}})}
                      className="w-5 h-5 rounded-lg border-2 border-slate-300 text-blue-500"
                    />
                    <span className="text-sm font-bold">API Access</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.limits.customModels}
                      onChange={e => setFormData({...formData, limits: {...formData.limits, customModels: e.target.checked}})}
                      className="w-5 h-5 rounded-lg border-2 border-slate-300 text-blue-500"
                    />
                    <span className="text-sm font-bold">Custom Models</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 p-6 border-t border-slate-200 dark:border-white/10 bg-inherit rounded-b-[32px] flex gap-3">
              <button 
                onClick={() => setShowPlanModal(false)}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                  ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}>
                Cancel
              </button>
              <button 
                onClick={handleSavePlan}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20">
                {editingPlan ? 'Save Changes' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign User Modal (Placeholder) */}
      {showAssignModal && selectedPlanForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAssignModal(false)} />
          <div className={`relative w-full max-w-md p-8 rounded-[32px] shadow-2xl text-center
            ${theme === 'dark' ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200'}`}>
            
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-2xl">
              <i className="fas fa-user-plus" />
            </div>
            
            <h3 className="text-xl font-black mb-2">Assign Plan to User</h3>
            <p className="text-sm text-slate-500 mb-6">
              Assign <span className="text-blue-500 font-bold">{selectedPlanForAssign.name}</span> to a user by email
            </p>
            
            <input 
              type="email" 
              placeholder="user@example.com"
              className={`w-full p-4 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 mb-4
                ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200'}`}
            />
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowAssignModal(false)}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest
                  ${theme === 'dark' ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-800'}`}>
                Cancel
              </button>
              <button 
                onClick={() => { setShowAssignModal(false); alert('Feature: Connect to user management API'); }}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/20">
                Assign Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  theme: 'light' | 'dark';
  label: string;
  value: string;
  change: string;
  positive: boolean;
  color: 'emerald' | 'blue' | 'purple' | 'orange';
}> = ({ theme, label, value, change, positive, color }) => {
  const colorClasses = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
  };

  return (
    <div className={`p-6 rounded-[24px] border backdrop-blur-sm transition-all hover:scale-[1.02]
      ${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} shadow-lg`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <p className={`text-2xl font-black bg-gradient-to-r ${colorClasses[color]} bg-clip-text text-transparent`}>
          {value}
        </p>
        <span className={`text-[10px] font-black px-2 py-1 rounded-full
          ${positive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
          {change}
        </span>
      </div>
    </div>
  );
};

export default Plans;
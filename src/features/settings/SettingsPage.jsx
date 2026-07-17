import { useState } from 'react'
import { Save, User, Bell, Shield, Palette, Key } from 'lucide-react'
import useThemeStore from '../../store/themeStore'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  
  // Profile state
  const [profile, setProfile] = useState({
    firstName: 'Zac',
    lastName: 'Admin',
    email: 'admin@zac.ai'
  });
  
  // Notification settings state
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    weeklyDigest: true,
    modelAlerts: false
  });
  
  // Security state
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Get theme state and actions from store
  const { theme, accentColor, setTheme, setAccentColor } = useThemeStore()
  
  // API keys state
  const [apiKeys, setApiKeys] = useState([
    { id: 'prod', name: 'Production API Key', value: 'zac_prod_••••••••••••••••', revealed: false },
    { id: 'dev', name: 'Development API Key', value: 'zac_dev_••••••••••••••••', revealed: false }
  ]);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'api', label: 'API Keys', icon: Key },
  ]

  // Handle profile form submission
  const handleProfileSubmit = (e) => {
    e.preventDefault();
    // In a real app, you would send this data to your backend
    console.log('Profile updated:', profile);
    alert('Profile updated successfully!');
  };

  // Handle notification toggle
  const handleNotificationToggle = (setting) => {
    setNotifications(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  // Handle security form submission
  const handleSecuritySubmit = (e) => {
    e.preventDefault();
    
    // Validation
    if (!security.currentPassword) {
      alert('Please enter your current password');
      return;
    }
    
    if (security.newPassword.length < 8) {
      alert('New password must be at least 8 characters');
      return;
    }
    
    if (security.newPassword !== security.confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    
    // In a real app, you would send this data to your backend
    console.log('Password change requested:', {
      currentPassword: security.currentPassword,
      newPassword: security.newPassword
    });
    
    // Reset form
    setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
    alert('Password updated successfully!');
  };

  // Toggle API key visibility
  const toggleApiKeyVisibility = (id) => {
    setApiKeys(prev => prev.map(key => 
      key.id === id ? { ...key, revealed: !key.revealed } : key
    ));
  };

  // Generate new API key - this updates existing keys instead of creating new ones
  const generateNewApiKey = () => {
    // In a real app, this would call your backend to regenerate keys
    const newProdKey = {
      id: 'prod',
      name: 'Production API Key',
      value: 'zac_prod_' + Math.random().toString(36).substring(2, 18),
      revealed: true
    };
    
    const newDevKey = {
      id: 'dev',
      name: 'Development API Key',
      value: 'zac_dev_' + Math.random().toString(36).substring(2, 18),
      revealed: true
    };
    
    setApiKeys([newProdKey, newDevKey]);
    alert('API keys regenerated successfully! Make sure to save the new keys.');
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="text-slate-500 mt-1">Manage your account and preferences.</p>
      </div>

      <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] overflow-hidden">
        <div className="border-b border-slate-200 dark:border-[var(--color-border-subtle)]">
          <nav className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-[var(--color-brand-500)] text-[var(--color-brand-500)]'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-[var(--color-text-primary)]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="max-w-2xl space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-[var(--color-brand-50)] flex items-center justify-center">
                  <span className="text-2xl font-bold text-indigo-700 dark:text-[var(--color-brand-500)]">Z</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">Zac Admin</h3>
                  <p className="text-sm text-slate-500">admin@zac.ai</p>
                </div>
              </div>

              <div className="grid grid-cols-1 min-750:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1">First Name</label>
                  <input 
                    type="text" 
                    value={profile.firstName} 
                    onChange={(e) => setProfile({...profile, firstName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-[var(--color-border-subtle)] bg-white dark:bg-[var(--color-bg-canvas)] rounded-lg text-sm text-slate-900 dark:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1">Last Name</label>
                  <input 
                    type="text" 
                    value={profile.lastName} 
                    onChange={(e) => setProfile({...profile, lastName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-[var(--color-border-subtle)] bg-white dark:bg-[var(--color-bg-canvas)] rounded-lg text-sm text-slate-900 dark:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]" 
                  />
                </div>
                <div className="min-750:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1">Email</label>
                  <input 
                    type="email" 
                    value={profile.email} 
                    onChange={(e) => setProfile({...profile, email: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-[var(--color-border-subtle)] bg-white dark:bg-[var(--color-bg-canvas)] rounded-lg text-sm text-slate-900 dark:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]" 
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button 
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-[var(--color-brand-500)] text-white rounded-lg text-sm font-medium hover:bg-indigo-700 dark:hover:opacity-90 transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-2xl space-y-4">
              {[
                { id: 'email', label: 'Email notifications', desc: 'Receive updates about email notifications.' },
                { id: 'push', label: 'Push notifications', desc: 'Receive updates about push notifications.' },
                { id: 'weeklyDigest', label: 'Weekly digest', desc: 'Receive updates about weekly digest.' },
                { id: 'modelAlerts', label: 'Model alerts', desc: 'Receive updates about model alerts.' }
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-[var(--color-border-subtle)] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={notifications[item.id]} 
                      onChange={() => handleNotificationToggle(item.id)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-[var(--color-border-strong)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--color-brand-50)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-brand-500)]"></div>
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleSecuritySubmit} className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)] mb-2">Change Password</h3>
                <div className="space-y-3">
                  <input 
                    type="password" 
                    placeholder="Current password" 
                    value={security.currentPassword}
                    onChange={(e) => setSecurity({...security, currentPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-[var(--color-border-subtle)] bg-white dark:bg-[var(--color-bg-canvas)] rounded-lg text-sm text-slate-900 dark:text-[var(--color-text-primary)] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]" 
                  />
                  <input 
                    type="password" 
                    placeholder="New password" 
                    value={security.newPassword}
                    onChange={(e) => setSecurity({...security, newPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-[var(--color-border-subtle)] bg-white dark:bg-[var(--color-bg-canvas)] rounded-lg text-sm text-slate-900 dark:text-[var(--color-text-primary)] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]" 
                  />
                  <input 
                    type="password" 
                    placeholder="Confirm new password" 
                    value={security.confirmPassword}
                    onChange={(e) => setSecurity({...security, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-[var(--color-border-subtle)] bg-white dark:bg-[var(--color-bg-canvas)] rounded-lg text-sm text-slate-900 dark:text-[var(--color-text-primary)] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]" 
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 dark:bg-[var(--color-brand-500)] text-white rounded-lg text-sm font-medium hover:bg-indigo-700 dark:hover:opacity-90 transition-colors cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </form>
          )}

          {activeTab === 'appearance' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)] mb-3">Theme</h3>
                <div className="grid grid-cols-3 gap-3">
                  {['Light', 'Dark', 'System'].map((themeOption) => {
                    const value = themeOption.toLowerCase();
                    const selected = theme === value;
                    return (
                      <button 
                        key={themeOption}
                        onClick={() => setTheme(value)}
                        className="p-4 border rounded-lg text-sm font-medium transition-colors cursor-pointer"
                        style={{
                          borderColor: selected ? 'var(--color-brand-500)' : 'var(--color-border-subtle)',
                          color: selected ? 'var(--color-brand-500)' : 'var(--color-text-secondary)',
                          backgroundColor: selected ? 'var(--color-brand-50)' : 'transparent',
                        }}
                      >
                        {themeOption}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)] mb-3">Accent Color</h3>
                <div className="flex gap-3">
                  {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'].map((color) => (
                    <button 
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className="w-8 h-8 rounded-full border-2 transition-colors cursor-pointer" 
                      style={{
                        backgroundColor: color,
                        borderColor: accentColor === color ? 'var(--color-text-primary)' : 'transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="max-w-2xl space-y-4">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[var(--color-bg-canvas)] rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{key.name}</p>
                    <p className="text-xs text-slate-500 font-mono mt-1">
                      {key.revealed ? key.value : '••••••••••••••••'}
                    </p>
                  </div>
                  <button 
                    onClick={() => toggleApiKeyVisibility(key.id)}
                    className="text-sm text-indigo-600 dark:text-[var(--color-brand-500)] hover:text-indigo-700 dark:hover:text-[var(--color-brand-700)] font-medium cursor-pointer"
                  >
                    {key.revealed ? 'Hide' : 'Reveal'}
                  </button>
                </div>
              ))}
              
              <button 
                onClick={generateNewApiKey}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-lg text-sm font-medium text-slate-700 dark:text-[var(--color-text-primary)] hover:bg-slate-50 dark:hover:bg-[var(--color-bg-canvas)] transition-colors cursor-pointer"
              >
                <Key className="w-4 h-4" />
                Generate New Key
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
# Profile System Quick Reference

## For Developers: Integrating with the Profile System

### Reading Profile Data

```typescript
// In any component under ProfileApp
import { useProfile } from './contexts/ProfileContext';

function MyComponent() {
  const { activeSession } = useProfile();
  
  // Access profile info
  const profileName = activeSession?.profile.name;
  
  // Access profile data
  const favorites = activeSession?.data.favorites || [];
  const volume = activeSession?.data.volume || 50;
  
  return <div>Welcome, {profileName}!</div>;
}
```

### Updating Profile Data

```typescript
import { useProfile } from './contexts/ProfileContext';

function MyComponent() {
  const { updateProfileData } = useProfile();
  
  const handleSomething = async () => {
    // Update any profile data field
    await updateProfileData({
      myCustomField: 'value',
      anotherField: 123
    });
  };
  
  return <button onClick={handleSomething}>Save</button>;
}
```

### Using Profile Settings Hook

```typescript
import { useProfileSettings } from './hooks/useProfileSettings';

function MyComponent({ profileSession }) {
  const { settings, updateSetting, toggleFavorite } = useProfileSettings(profileSession);
  
  // Read
  const isFavorite = settings.favorites.includes(channelId);
  const lastChannel = settings.lastChannelId;
  
  // Write
  await toggleFavorite(channelId);
  await updateSetting('volume', 75);
  
  return <div>Favorites: {settings.favorites.length}</div>;
}
```

### Listening to Profile Changes

```typescript
import { useProfile } from './contexts/ProfileContext';
import { useEffect } from 'react';

function MyComponent() {
  const profile = useProfile();
  
  useEffect(() => {
    // Register listener
    const unsubscribe = profile.onProfileChange(async (newSession, oldSession) => {
      console.log('Profile changed!');
      
      if (oldSession) {
        // Cleanup for old profile
        console.log('Cleaning up:', oldSession.profile.name);
      }
      
      if (newSession) {
        // Initialize for new profile
        console.log('Initializing:', newSession.profile.name);
      } else {
        // User logged out
        console.log('User logged out');
      }
    });
    
    // Cleanup
    return unsubscribe;
  }, [profile]);
  
  return <div>Component</div>;
}
```

### Switching Profiles

```typescript
import { useProfile } from './contexts/ProfileContext';

function ProfileSwitcher() {
  const { switchProfile, profiles } = useProfile();
  
  const handleSwitch = async (profileId: string, pin?: string) => {
    try {
      await switchProfile({ profileId, pin });
      // Switch successful, app will reload with new profile
    } catch (err) {
      console.error('Switch failed:', err);
      // Show error to user
    }
  };
  
  return (
    <select onChange={(e) => handleSwitch(e.target.value)}>
      {profiles.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
```

### Adding New Profile Data Fields

1. **Update Type Definition** (`src/types/profile.ts`):
```typescript
export interface ProfileData {
  // Existing fields...
  favorites: number[];
  
  // Add your new field
  myNewField?: string;
  mySettings?: {
    enabled: boolean;
    value: number;
  };
}
```

2. **Add Default Value** (`electron/profile-manager.ts`):
```typescript
// In loadProfileData() fallback
return {
  favorites: [],
  channelHistory: [],
  volume: 50,
  myNewField: 'default',  // Add default
  mySettings: { enabled: true, value: 0 }
};
```

3. **Use in Components**:
```typescript
const { activeSession, updateProfileData } = useProfile();

// Read
const myValue = activeSession?.data.myNewField;

// Write
await updateProfileData({ myNewField: 'new value' });
```

### Profile-Scoped Hooks Pattern

```typescript
// Create profile-scoped hook
export function useMyProfileFeature(
  profileSession: ProfileSession,
  updateProfileData: (data: any) => Promise<void>
) {
  const [state, setState] = useState(() => {
    // Initialize from profile data
    return profileSession.data.myFeatureData || defaultState;
  });
  
  // Sync state changes to profile
  useEffect(() => {
    const save = async () => {
      await updateProfileData({ myFeatureData: state });
    };
    
    const timer = setTimeout(save, 1000); // Debounce
    return () => clearTimeout(timer);
  }, [state, updateProfileData]);
  
  return { state, setState };
}

// Use in App.tsx
function App({ profileSession }: AppProps) {
  const profile = useProfile();
  const myFeature = useMyProfileFeature(
    profileSession, 
    profile.updateProfileData
  );
  
  // Use myFeature...
}
```

### Cleanup Pattern for Profile Switches

```typescript
function MyComponent() {
  const profile = useProfile();
  const myServiceRef = useRef<MyService | null>(null);
  
  useEffect(() => {
    // Initialize service
    myServiceRef.current = new MyService();
    
    // Listen for profile changes
    const unsubscribe = profile.onProfileChange(async (newSession, oldSession) => {
      // Cleanup old service
      if (myServiceRef.current) {
        await myServiceRef.current.dispose();
        myServiceRef.current = null;
      }
      
      // Initialize new service (if not logging out)
      if (newSession) {
        myServiceRef.current = new MyService();
      }
    });
    
    // Cleanup on unmount
    return () => {
      unsubscribe();
      if (myServiceRef.current) {
        myServiceRef.current.dispose();
      }
    };
  }, [profile]);
  
  return <div>Component</div>;
}
```

### Common Patterns

#### Pattern 1: Conditional Rendering Based on Profile

```typescript
function FeatureComponent() {
  const { activeSession } = useProfile();
  
  if (!activeSession) {
    return <div>Please login</div>;
  }
  
  return <div>Welcome, {activeSession.profile.name}!</div>;
}
```

#### Pattern 2: Per-Profile Cache

```typescript
function MyCachedComponent() {
  const { activeSession } = useProfile();
  const [cache, setCache] = useState<Map<string, any>>(new Map());
  
  useEffect(() => {
    if (!activeSession) return;
    
    const profileCache = cache.get(activeSession.profile.id);
    if (!profileCache) {
      // Load data for this profile
      loadData().then(data => {
        setCache(prev => new Map(prev).set(activeSession.profile.id, data));
      });
    }
  }, [activeSession]);
  
  return <div>Cached data</div>;
}
```

#### Pattern 3: Profile-Specific Config

```typescript
function ConfigurableFeature({ profileSession }: { profileSession: ProfileSession }) {
  const config = profileSession.data.myFeatureConfig || {
    enabled: true,
    mode: 'auto',
    threshold: 50
  };
  
  const { updateProfileData } = useProfile();
  
  const updateConfig = async (newConfig: any) => {
    await updateProfileData({ myFeatureConfig: { ...config, ...newConfig } });
  };
  
  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => updateConfig({ enabled: e.target.checked })}
        />
        Enable Feature
      </label>
    </div>
  );
}
```

## Testing Helpers

### Mock Profile Session

```typescript
const mockProfileSession: ProfileSession = {
  profile: {
    id: 'test-123',
    name: 'Test User',
    avatar: '👤',
    hasPin: false,
    createdAt: Date.now(),
  },
  data: {
    favorites: [1, 2, 3],
    channelHistory: [],
    volume: 50,
  },
  loggedInAt: Date.now(),
};

// Use in tests
<App profileSession={mockProfileSession} />
```

### Test Profile Switching

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useProfile } from './contexts/ProfileContext';

test('profile switch clears old data', async () => {
  const { result } = renderHook(() => useProfile());
  
  // Login to profile A
  await act(async () => {
    await result.current.login({ profileId: 'profile-a' });
  });
  
  expect(result.current.activeSession?.profile.id).toBe('profile-a');
  
  // Switch to profile B
  await act(async () => {
    await result.current.switchProfile({ profileId: 'profile-b' });
  });
  
  expect(result.current.activeSession?.profile.id).toBe('profile-b');
});
```

## Common Pitfalls

### ❌ DON'T: Access profile data without null check

```typescript
// Bad
const favorites = activeSession.data.favorites;
// Error if user not logged in!
```

```typescript
// Good
const favorites = activeSession?.data.favorites || [];
```

### ❌ DON'T: Store profile data in component state without sync

```typescript
// Bad
const [favorites, setFavorites] = useState(profileSession.data.favorites);
// Not synced with profile changes!
```

```typescript
// Good
const { settings } = useProfileSettings(profileSession);
const favorites = settings.favorites; // Always synced
```

### ❌ DON'T: Forget to cleanup on profile change

```typescript
// Bad
useEffect(() => {
  const timer = setInterval(doSomething, 1000);
  return () => clearInterval(timer);
}, []); // Will keep running after profile switch!
```

```typescript
// Good
useEffect(() => {
  const timer = setInterval(doSomething, 1000);
  
  const unsubscribe = profile.onProfileChange(() => {
    clearInterval(timer); // Cleanup on switch
  });
  
  return () => {
    clearInterval(timer);
    unsubscribe();
  };
}, [profile]);
```

### ❌ DON'T: Call updateProfileData in render

```typescript
// Bad
function MyComponent() {
  updateProfileData({ something: 'value' }); // Infinite loop!
  return <div>Component</div>;
}
```

```typescript
// Good
function MyComponent() {
  const handleClick = () => {
    updateProfileData({ something: 'value' });
  };
  return <button onClick={handleClick}>Update</button>;
}
```

## Debugging

### Enable Profile Logs

All profile operations log to console:
```
[ProfileContext] Profile change: { old: "Alice", new: "Bob" }
[App] Profile change detected
[App] Stopping playback due to profile change
[App] Saving last channel for old profile
[App] Profile change cleanup complete
```

### Inspect Profile Data

```typescript
// In browser console
window.electron.profile.getActive().then(console.log);
```

### Force Save

```typescript
// In browser console
window.electron.profile.save().then(() => console.log('Saved!'));
```

### View Profile Files

```bash
# Windows
dir %APPDATA%\jptv-player\profiles

# View profile data
type %APPDATA%\jptv-player\profiles\{uuid}\data.json
```

## Performance Tips

1. **Debounce frequent updates**:
   ```typescript
   useEffect(() => {
     const timer = setTimeout(() => {
       updateProfileData({ field: value });
     }, 1000);
     return () => clearTimeout(timer);
   }, [value]);
   ```

2. **Batch updates**:
   ```typescript
   // Instead of multiple calls:
   await updateProfileData({ field1: value1 });
   await updateProfileData({ field2: value2 });
   
   // Do one call:
   await updateProfileData({ field1: value1, field2: value2 });
   ```

3. **Use memo for derived data**:
   ```typescript
   const expensiveComputation = useMemo(() => {
     return computeSomething(profileSession.data);
   }, [profileSession.data]);
   ```

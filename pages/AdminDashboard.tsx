import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile, Test, Question, TestSession, StudentAnswer, StudentResult, TestWithQuestions, QuestionOption, AuditLog } from '../types';
import { 
    Logo, UserIcon, LogoutIcon, DashboardIcon, UsersIcon, ClipboardListIcon, BarChartIcon, 
    PlayIcon, PauseIcon, StopIcon, RefreshCwIcon, PlusCircleIcon, EditIcon, Trash2Icon, UploadIcon, HistoryIcon
} from '../components/Icons';
import { Spinner } from '../components/Spinner';
import { Modal } from '../components/Modal';
import { logAuditEvent } from '../services/logging';

// --- Helper Components defined inside AdminDashboard ---

const Header: React.FC<{ profile: Profile; onLogout: () => void; onEditProfile: () => void; }> = ({ profile, onLogout, onEditProfile }) => (
    <header className="bg-white dark:bg-slate-800 shadow-md p-4 flex justify-between items-center">
        <div className="flex items-center">
            <Logo className="w-8 h-8 text-indigo-600" />
            <h1 className="ml-3 text-xl font-bold text-slate-800 dark:text-slate-200">Admin Dashboard</h1>
        </div>
        <div className="flex items-center space-x-4">
            <button onClick={onEditProfile} className="flex items-center p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <UserIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                <span className="ml-2 text-slate-700 dark:text-slate-300">{profile.full_name || profile.email}</span>
            </button>
            <button onClick={onLogout} className="flex items-center text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                <LogoutIcon className="w-6 h-6" />
                <span className="ml-1">Logout</span>
            </button>
        </div>
    </header>
);

const Sidebar: React.FC<{ activeTab: string; setActiveTab: (tab: string) => void }> = ({ activeTab, setActiveTab }) => {
    const navItems = [
        { id: 'control', label: 'Test Control', icon: DashboardIcon },
        { id: 'tests', label: 'Test Management', icon: ClipboardListIcon },
        { id: 'users', label: 'User Management', icon: UsersIcon },
        { id: 'results', label: 'Results & Analytics', icon: BarChartIcon },
        { id: 'audit', label: 'Audit Logs', icon: HistoryIcon },
    ];

    const baseStyle = "flex items-center w-full p-3 my-1 rounded-lg transition-colors";
    const activeStyle = "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-semibold";
    const inactiveStyle = "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700";

    return (
        <aside className="w-64 bg-white dark:bg-slate-800 p-4 shadow-lg">
            <nav>
                <ul>
                    {navItems.map(item => (
                        <li key={item.id}>
                            <button onClick={() => setActiveTab(item.id)} className={`${baseStyle} ${activeTab === item.id ? activeStyle : inactiveStyle}`}>
                                <item.icon className="w-6 h-6 mr-3" />
                                {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
};


// --- Main AdminDashboard Component ---

const AdminDashboard: React.FC<{ user: User; profile: Profile }> = ({ user, profile }) => {
    const [activeTab, setActiveTab] = useState('control');
    const [tests, setTests] = useState<Test[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);
    const [testSession, setTestSession] = useState<TestSession | null>(null);
    const [loading, setLoading] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [sessionError, setSessionError] = useState<string | null>(null);
    
    const handleLogout = async () => {
        await logAuditEvent('admin_logout');
        await supabase!.auth.signOut();
    };

    const fetchTests = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase!.from('tests').select('*').order('created_at', { ascending: false });
        if (error) console.error('Error fetching tests:', error.message, error);
        else setTests(data || []);
        setLoading(false);
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase!.from('profiles').select('*').eq('role', 'student');
        if (error) console.error('Error fetching users:', error.message, error);
        else setUsers(data || []);
        setLoading(false);
    }, []);

    const fetchTestSession = useCallback(async () => {
        setSessionLoading(true);
        setSessionError(null);
        try {
            const { data, error } = await supabase!.from('test_sessions').select('*').eq('id', 'active_session').single();

            if (error) {
                if (error.code === 'PGRST116') {
                    const { data: newSession, error: createError } = await supabase!
                        .from('test_sessions')
                        .insert([{ id: 'active_session', status: 'waiting', duration_minutes: 60 }])
                        .select()
                        .single();

                    if (createError) throw createError;
                    setTestSession(newSession);
                } else {
                    throw error;
                }
            } else {
                setTestSession(data);
            }
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes("does not exist")) {
                const tableName = errorMessage.match(/relation "public\.(.*?)" does not exist/)?.[1];
                setSessionError(`Database schema error: The table '${tableName || 'test_sessions'}' is missing. Please run the setup script from supabase.md.`);
           } else {
                console.error('Error fetching test session:', errorMessage, err);
                setSessionError(`Failed to fetch session: ${errorMessage || 'Please check your network connection.'}`);
           }
        } finally {
            setSessionLoading(false);
        }
    }, []);


    useEffect(() => {
        fetchTestSession();
        const channel = supabase!.channel('test-session-admin')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'test_sessions', filter: 'id=eq.active_session' },
                payload => {
                    setTestSession(payload.new as TestSession);
                }
            )
            .subscribe();

        return () => {
            supabase!.removeChannel(channel);
        };
    }, [fetchTestSession]);

    const renderContent = () => {
        switch (activeTab) {
            case 'control':
                return <TestControlPanel 
                            tests={tests} 
                            fetchTests={fetchTests} 
                            session={testSession}
                            loading={sessionLoading}
                            error={sessionError}
                            onRetry={fetchTestSession}
                        />;
            case 'tests':
                return <TestManagement user={user} tests={tests} fetchTests={fetchTests} loading={loading} />;
            case 'users':
                return <UserManagement users={users} fetchUsers={fetchUsers} loading={loading}/>;
            case 'results':
                return <ResultsAnalytics tests={tests} fetchTests={fetchTests} />;
            case 'audit':
                return <AuditLogViewer />;
            default:
                return <div>Welcome!</div>;
        }
    };

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <div className="flex-1 flex flex-col">
                <Header profile={profile} onLogout={handleLogout} onEditProfile={() => setIsProfileModalOpen(true)} />
                <main className="flex-1 p-6 overflow-y-auto">
                    {renderContent()}
                </main>
            </div>
            <ProfileModal 
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                user={user}
                profile={profile}
            />
        </div>
    );
};


// --- Tab Components ---

const TestControlPanel: React.FC<{ 
    tests: Test[], 
    fetchTests: () => void, 
    session: TestSession | null,
    loading: boolean,
    error: string | null,
    onRetry: () => void 
}> = ({ tests, fetchTests, session, loading, error, onRetry }) => {
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
    const [duration, setDuration] = useState(60);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);


    useEffect(() => {
        fetchTests();
    }, [fetchTests]);

    useEffect(() => {
        let interval: number | undefined;
        if (session?.status === 'started' && session.start_time) {
            const calculateTimeLeft = () => {
                const now = new Date().getTime();
                const start = new Date(session.start_time!).getTime();
                const grossElapsedSeconds = Math.floor((now - start) / 1000);
                const netElapsedSeconds = grossElapsedSeconds - (session.total_paused_duration_seconds || 0);
                const totalSeconds = session.duration_minutes * 60;
                return Math.max(0, totalSeconds - netElapsedSeconds);
            };
            setTimeLeft(calculateTimeLeft());
            interval = window.setInterval(() => {
                setTimeLeft(calculateTimeLeft());
            }, 1000);
        } else if (session?.status !== 'started' && session?.start_time) {
            const start = new Date(session.start_time).getTime();
            const end = session.last_paused_at ? new Date(session.last_paused_at).getTime() : new Date().getTime();
            const grossElapsedSeconds = Math.floor((end - start) / 1000);
            const netElapsedSeconds = grossElapsedSeconds - (session.total_paused_duration_seconds || 0);
            const totalSeconds = session.duration_minutes * 60;
            setTimeLeft(Math.max(0, totalSeconds - netElapsedSeconds));
        } else {
            setTimeLeft(session?.duration_minutes ? session.duration_minutes * 60 : 0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [session]);
    
    const handleControlAction = async (newStatus: TestSession['status']) => {
        console.log(`--- handleControlAction called with status: '${newStatus}' ---`);
        const timestamp = new Date().toISOString();
    
        // This is the RESET logic
        if (newStatus === 'waiting') {
            console.log(`[${timestamp}] --- Reset Test Logic Initiated ---`);
            console.log(`[RESET] Attempting to call Supabase RPC: 'reset_test_session'`);
            const { error: resetError } = await supabase!.rpc('reset_test_session');
            if (resetError) {
                console.error(`[RESET] RPC call FAILED. Error:`, resetError);
                alert(`Failed to reset test session: ${resetError.message}`);
                console.log(`[${timestamp}] --- Reset Test Logic Aborted due to Error ---`);
            } else {
                console.log(`[RESET] RPC call SUCCEEDED.`);
                logAuditEvent('test_reset', { previousTestId: session?.test_id });
                console.log(`[RESET] Audit event logged. UI will update via realtime subscription.`);
                console.log(`[${timestamp}] --- Reset Test Logic Completed Successfully ---`);
            }
            return;
        }
    
        // This is the logic for PAUSE, START, FINISH
        console.log(`[${timestamp}] --- Session Control Action Initiated: ${newStatus.toUpperCase()} ---`);
        console.log(`[${newStatus.toUpperCase()}] Current session state:`, session);
    
        const updates: Partial<TestSession> = { status: newStatus };
        const previousStatus = session?.status;
        let testTitle: string | undefined;
    
        if (newStatus === 'started') { // Handle both Start and Resume
            if (previousStatus === 'paused') { // RESUME
                console.log(`[RESUME] Test is being resumed.`);
                if (session?.last_paused_at) {
                    const pausedAt = new Date(session.last_paused_at).getTime();
                    const now = new Date().getTime();
                    const currentPauseDuration = Math.round((now - pausedAt) / 1000);
                    updates.total_paused_duration_seconds = (session.total_paused_duration_seconds || 0) + currentPauseDuration;
                    updates.last_paused_at = null;
                    console.log(`[RESUME] Calculated pause duration: ${currentPauseDuration}s. New total paused duration: ${updates.total_paused_duration_seconds}s.`);
                }
            } else { // START (from waiting/finished)
                console.log(`[START] Test is being started.`);
                const testIdToStart = selectedTestId || session?.test_id;
                if (!testIdToStart) {
                    alert('Please select a test to start.');
                    console.log(`[START] Aborted: No test selected.`);
                    return;
                }
                testTitle = tests.find(t => t.id === testIdToStart)?.title;
                updates.start_time = new Date().toISOString();
                if (selectedTestId) updates.test_id = selectedTestId;
                updates.duration_minutes = duration;
                updates.test_title = testTitle;
                updates.total_paused_duration_seconds = 0;
                updates.last_paused_at = null;
            }
        } else if (newStatus === 'paused') {
            console.log(`[PAUSE] Test is being paused.`);
            updates.last_paused_at = new Date().toISOString();
            console.log(`[PAUSE] Setting 'last_paused_at' to: ${updates.last_paused_at}`);
        }
    
        console.log(`[${newStatus.toUpperCase()}] Preparing to update 'test_sessions' table with payload:`, updates);
        const { error } = await supabase!.from('test_sessions').update(updates).eq('id', 'active_session');
        
        if (error) {
            console.error(`[${newStatus.toUpperCase()}] Database update FAILED. Error:`, error);
            alert('Error updating session: ' + error.message);
            console.log(`[${timestamp}] --- Session Control Action Aborted due to Error: ${newStatus.toUpperCase()} ---`);
            return;
        }
    
        console.log(`[${newStatus.toUpperCase()}] Database update SUCCEEDED.`);
        const testIdForAudit = session?.test_id || selectedTestId;
        const auditAction = 
            newStatus === 'started' ? (previousStatus === 'paused' ? 'test_resumed' : 'test_started') :
            newStatus === 'paused' ? 'test_paused' :
            newStatus === 'finished' ? 'test_finished' : '';
    
        if (auditAction) {
            logAuditEvent(auditAction, { testId: testIdForAudit, testTitle, duration });
            console.log(`[${newStatus.toUpperCase()}] Audit event '${auditAction}' logged.`);
        }
    
        console.log(`[${timestamp}] --- Session Control Action Completed Successfully: ${newStatus.toUpperCase()} ---`);
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg flex justify-center items-center min-h-[300px]">
                <Spinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center" role="alert">
                    <strong className="font-bold">Error!</strong>
                    <span className="block sm:inline ml-2">{error}</span>
                    <div className="mt-4">
                        <button 
                            onClick={onRetry} 
                            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-4">Test Control Panel</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Test Setup */}
                    <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-md">
                        <h3 className="text-lg font-semibold mb-3">1. Setup Test</h3>
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="test-select" className="block text-sm font-medium text-slate-600 dark:text-slate-300">Select Test</label>
                                <select 
                                    id="test-select"
                                    value={selectedTestId || ''}
                                    onChange={e => setSelectedTestId(e.target.value)}
                                    disabled={session?.status === 'started' || session?.status === 'paused'}
                                    className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800"
                                >
                                    <option value="" disabled>-- Select a test --</option>
                                    {tests.map(test => <option key={test.id} value={test.id}>{test.title}</option>)}
                                </select>
                            </div>
                            <div>
                                 <label htmlFor="duration" className="block text-sm font-medium text-slate-600 dark:text-slate-300">Duration (minutes)</label>
                                 <input 
                                    type="number" 
                                    id="duration" 
                                    value={duration} 
                                    onChange={e => setDuration(parseInt(e.target.value))}
                                    disabled={session?.status === 'started' || session?.status === 'paused'}
                                    className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Test Status & Timer */}
                    <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-md flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg font-semibold mb-3">2. Live Status</h3>
                          <div className="flex items-center space-x-3 mb-4">
                              <span className="text-slate-600 dark:text-slate-300">Status:</span>
                              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                                  session?.status === 'started' ? 'bg-green-100 text-green-800' :
                                  session?.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                                  session?.status === 'finished' ? 'bg-red-100 text-red-800' :
                                  'bg-slate-200 text-slate-800'
                              }`}>
                                  {session?.status?.toUpperCase()}
                              </span>
                          </div>
                           <p className="text-sm text-slate-500 dark:text-slate-400">
                               Active Test: <span className="font-semibold">{session?.test_title || 'None'}</span>
                           </p>
                        </div>
                        <div className="text-center mt-4">
                            <span className="text-5xl font-mono tracking-widest text-slate-800 dark:text-slate-200">{formatTime(timeLeft)}</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Time Remaining</p>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">3. Controls</h3>
                    <div className="flex flex-wrap gap-4">
                        <button onClick={() => handleControlAction('started')} disabled={session?.status === 'started'} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md disabled:bg-green-300">
                            <PlayIcon className="w-5 h-5"/> {session?.status === 'paused' ? 'Resume' : 'Start'}
                        </button>
                        <button onClick={() => handleControlAction('paused')} disabled={session?.status !== 'started'} className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-md disabled:bg-yellow-300">
                            <PauseIcon className="w-5 h-5"/> Pause
                        </button>
                        <button onClick={() => handleControlAction('finished')} disabled={session?.status === 'finished' || session?.status === 'waiting'} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md disabled:bg-red-300">
                            <StopIcon className="w-5 h-5"/> Finish
                        </button>
                        <button 
                            onClick={() => {
                                console.log('Reset button clicked. Opening confirmation modal.');
                                setIsResetConfirmModalOpen(true);
                            }} 
                            className="flex items-center gap-2 bg-slate-500 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md"
                        >
                            <RefreshCwIcon className="w-5 h-5"/> Reset
                        </button>
                    </div>
                </div>
                <div className="mt-8">
                    <LiveStudentStatus session={session} selectedTestId={selectedTestId} tests={tests} />
                </div>
            </div>
            <Modal
                isOpen={isResetConfirmModalOpen}
                onClose={() => {
                    console.log('Reset action cancelled by user via modal close.');
                    setIsResetConfirmModalOpen(false);
                }}
                title="Confirm Session Reset"
            >
                <div>
                    <p className="text-slate-600 dark:text-slate-300">
                        Are you sure you want to reset the test session? This will permanently delete all student answers and submissions for the current session.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button 
                            onClick={() => {
                                console.log('Reset action cancelled by user via Cancel button.');
                                setIsResetConfirmModalOpen(false);
                            }} 
                            className="bg-slate-200 dark:bg-slate-600 px-4 py-2 rounded font-semibold hover:bg-slate-300 dark:hover:bg-slate-500"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                console.log('User confirmed reset via modal.');
                                setIsResetConfirmModalOpen(false);
                                handleControlAction('waiting');
                            }}
                            className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700"
                        >
                            Yes, Reset Session
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

interface StudentStatus {
    profile: Profile;
    answered: number;
    total: number;
}

interface LiveStudentStatusProps {
    session: TestSession | null;
    selectedTestId: string | null;
    tests: Test[];
}

const LiveStudentStatus: React.FC<LiveStudentStatusProps> = ({ session, selectedTestId, tests }) => {
    const [statuses, setStatuses] = useState<StudentStatus[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: profiles, error: profilesError } = await supabase!.from('profiles').select('*').eq('role', 'student');
            if (profilesError) throw profilesError;

            // In waiting/finished state, we just need the list of students.
            if (!session?.test_id || session.status === 'waiting' || session.status === 'finished') {
                const studentStatuses = (profiles || []).map(profile => ({
                    profile,
                    answered: 0,
                    total: 0,
                })).sort((a,b) => (a.profile.full_name || '').localeCompare(b.profile.full_name || ''));
                setStatuses(studentStatuses);
                return;
            }

            // If a test is active, get progress data.
            const [questionsRes, answersRes] = await Promise.all([
                supabase!.from('questions').select('id').eq('test_id', session.test_id),
                supabase!.from('student_answers').select('student_id').eq('session_id', 'active_session')
            ]);

            if (questionsRes.error) throw questionsRes.error;
            if (answersRes.error) throw answersRes.error;

            const total = questionsRes.data.length;
            const answersByStudent = new Map<string, number>();
            for (const ans of answersRes.data) {
                answersByStudent.set(ans.student_id, (answersByStudent.get(ans.student_id) || 0) + 1);
            }

            const studentStatuses = (profiles || []).map(profile => ({
                profile,
                answered: answersByStudent.get(profile.id) || 0,
                total,
            })).sort((a,b) => (a.profile.full_name || '').localeCompare(b.profile.full_name || ''));

            setStatuses(studentStatuses);

        } catch (error: any) {
            console.error("Error fetching student statuses:", error.message, error);
             if (error?.message?.includes("does not exist")) {
                const tableName = error.message.match(/relation "public\.(.*?)" does not exist/)?.[1];
                console.error(`SCHEMA ERROR in LiveStudentStatus: The table '${tableName}' is missing. Please run the setup script from supabase.md.`);
            }
        } finally {
            setLoading(false);
        }
    }, [session?.test_id, session?.status]);
    
    useEffect(() => {
        fetchData();

        const channel = supabase!
            .channel('student-answers-changes')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'student_answers', filter: `session_id=eq.active_session` },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase!.removeChannel(channel);
        };
    }, [fetchData]);

    const getStatusBadge = (answered: number, total: number) => {
        if (!session || session.status === 'waiting' || session.status === 'finished') {
            return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Online</span>;
        }
        if (session.status === 'paused') {
            return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-200 text-yellow-900">Paused</span>;
        }
        if (answered === 0) {
            return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Started</span>;
        }
        if (answered > 0 && answered < total) {
            return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">In Progress</span>;
        }
        if (answered === total) {
            return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Completed</span>;
        }
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-200 text-slate-800">Idle</span>;
    };
    
    const isTestActive = session?.status === 'started' || session?.status === 'paused';
    
    let title = "Students in Waiting Room";
    if (isTestActive && session?.test_title) {
        title = `Live Status: ${session.test_title}`;
    } else if (session?.status === 'waiting' && selectedTestId) {
        const selectedTestTitle = tests.find(t => t.id === selectedTestId)?.title;
        if (selectedTestTitle) {
            title = `Waiting Room (Preparing: ${selectedTestTitle})`;
        }
    }

    if (loading) {
        return (
            <div>
                <h3 className="text-xl font-semibold mb-3">{title}</h3>
                <div className="flex justify-center items-center h-24"><Spinner /></div>
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-xl font-semibold mb-3">{title}</h3>
            <div className="overflow-x-auto bg-slate-50 dark:bg-slate-700 rounded-md max-h-96">
                <table className="w-full text-left">
                    <thead className="border-b dark:border-slate-600 sticky top-0 bg-slate-100 dark:bg-slate-700">
                        <tr>
                            <th className="p-3">Student Name</th>
                            <th className="p-3">University ID</th>
                            <th className="p-3">Status</th>
                            {isTestActive && <th className="p-3">Progress</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {statuses.length === 0 ? (
                            <tr>
                                <td colSpan={isTestActive ? 4 : 3} className="p-4 text-center text-slate-500 dark:text-slate-400">No students are online.</td>
                            </tr>
                        ) : statuses.map(s => (
                            <tr key={s.profile.id} className="border-b dark:border-slate-600 last:border-b-0">
                                <td className="p-3 font-medium">{s.profile.full_name || s.profile.email || 'Unnamed User'}</td>
                                <td className="p-3">{s.profile.university_id}</td>
                                <td className="p-3">{getStatusBadge(s.answered, s.total)}</td>
                                {isTestActive && (
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            <span>{s.answered} / {s.total}</span>
                                            {s.total > 0 && (
                                                <div className="w-24 bg-slate-200 dark:bg-slate-600 rounded-full h-2.5">
                                                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${(s.answered / s.total) * 100}%` }}></div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


const TestManagement: React.FC<{ user: User, tests: Test[], fetchTests: () => void, loading: boolean }> = ({ user, tests, fetchTests, loading }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTest, setEditingTest] = useState<TestWithQuestions | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchTests();
    }, [fetchTests]);

    const handleOpenModal = (test: TestWithQuestions | null = null) => {
        setEditingTest(test);
        setIsModalOpen(true);
    };

    const handleDeleteTest = async (testId: string) => {
        const testToDelete = tests.find(t => t.id === testId);
        if(!testToDelete) return;

        if(window.confirm(`Are you sure you want to delete the test "${testToDelete.title}" and all its questions?`)) {
            const { error } = await supabase!.from('tests').delete().eq('id', testId);
            if(error) {
                alert('Error deleting test: ' + error.message);
            } else {
                logAuditEvent('test_deleted', { testId: testToDelete.id, testTitle: testToDelete.title });
                fetchTests();
            }
        }
    }
    
    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportError(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("Could not read file content.");

                const data = JSON.parse(text);
                if (!data.title || !Array.isArray(data.questions)) throw new Error("Invalid JSON format.");

                const { data: testData, error: testError } = await supabase!.from('tests').insert({ title: data.title, description: data.description || '', created_by: user.id }).select('id').single();
                if (testError) throw testError;
                const testId = testData!.id;

                const questionsToInsert = data.questions.map((q: any) => ({ test_id: testId, question_text: q.question_text, options: q.options }));
                const { error: questionsError } = await supabase!.from('questions').insert(questionsToInsert);

                if (questionsError) {
                    await supabase!.from('tests').delete().eq('id', testId); // Rollback
                    throw questionsError;
                }
                logAuditEvent('test_imported', { testId, testTitle: data.title, questionCount: questionsToInsert.length });
                fetchTests();
            } catch (error) {
                if (error instanceof Error) setImportError(error.message);
                else setImportError("An unknown error occurred during import.");
            } finally {
                setIsImporting(false);
            }
        };
        reader.readAsText(file);
        if (event.target) event.target.value = "";
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 className="text-2xl font-bold">Test Management</h2>
                <div className="flex gap-3">
                    <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex items-center gap-2 bg-slate-500 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md disabled:bg-slate-400">
                       {isImporting ? <Spinner /> : <UploadIcon className="w-5 h-5" />} Import from JSON
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept="application/json" />
                    <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">
                        <PlusCircleIcon className="w-5 h-5" /> Create Test
                    </button>
                </div>
            </div>
            {importError && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{importError}</div>}
            {loading ? <Spinner /> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 dark:bg-slate-700">
                            <tr>
                                <th className="p-3">Title</th>
                                <th className="p-3">Description</th>
                                <th className="p-3">Created At</th>
                                <th className="p-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tests.map(test => (
                                <tr key={test.id} className="border-b dark:border-slate-700">
                                    <td className="p-3">{test.title}</td>
                                    <td className="p-3 truncate max-w-xs">{test.description}</td>
                                    <td className="p-3">{new Date(test.created_at).toLocaleString()}</td>
                                    <td className="p-3 flex gap-2">
                                        <button onClick={async () => {
                                            const { data, error } = await supabase!.from('questions').select('*').eq('test_id', test.id);
                                            if (error) { alert("Could not fetch questions"); return; }
                                            handleOpenModal({ ...test, questions: data || [] })
                                        }} className="text-indigo-600 hover:text-indigo-800"><EditIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleDeleteTest(test.id)} className="text-red-600 hover:text-red-800"><Trash2Icon className="w-5 h-5"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <TestEditorModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                test={editingTest} 
                userId={user.id}
                onSave={() => {
                    setIsModalOpen(false);
                    fetchTests();
                }} 
            />
        </div>
    );
};

const TestEditorModal: React.FC<{ isOpen: boolean; onClose: () => void; test: TestWithQuestions | null; userId: string; onSave: () => void; }> = ({ isOpen, onClose, test, userId, onSave }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<Partial<Question>[]>([]);

    useEffect(() => {
        if (test) {
            setTitle(test.title);
            setDescription(test.description);
            setQuestions(test.questions);
        } else {
            setTitle('');
            setDescription('');
            setQuestions([{ question_text: '', options: [{text:'', isCorrect: false},{text:'', isCorrect: false},{text:'', isCorrect: false},{text:'', isCorrect: false}] }]);
        }
    }, [test, isOpen]);

    const handleQuestionChange = (index: number, value: string) => {
        const newQuestions = [...questions];
        newQuestions[index].question_text = value;
        setQuestions(newQuestions);
    };

    const handleOptionChange = (qIndex: number, oIndex: number, value: string) => {
        const newQuestions = [...questions];
        (newQuestions[qIndex].options as QuestionOption[])[oIndex].text = value;
        setQuestions(newQuestions);
    }
    
    const handleCorrectOptionChange = (qIndex: number, oIndex: number) => {
        const newQuestions = [...questions];
        (newQuestions[qIndex].options as QuestionOption[]).forEach((opt, idx) => {
            opt.isCorrect = idx === oIndex;
        });
        setQuestions(newQuestions);
    }

    const addQuestion = () => {
        setQuestions([...questions, { question_text: '', options: [{text:'', isCorrect: true},{text:'', isCorrect: false},{text:'', isCorrect: false},{text:'', isCorrect: false}] }]);
    };
    
    const removeQuestion = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        let testId = test?.id;
        
        if (testId) {
            const { error } = await supabase!.from('tests').update({ title, description }).eq('id', testId);
            if (error) { alert('Error updating test: ' + error.message); return; }
        } else {
            const { data, error } = await supabase!.from('tests').insert({ title, description, created_by: userId }).select('id').single();
            if (error) { alert('Error creating test: ' + error.message); return; }
            testId = data!.id;
        }

        const { error: qError } = await supabase!.from('questions').upsert(questions.map(q => ({...q, test_id: testId})));
        if(qError) { alert('Error saving questions: ' + qError.message); return; }
        
        logAuditEvent(test ? 'test_updated' : 'test_created', { testId, title });
        onSave();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={test ? 'Edit Test' : 'Create Test'}>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <input type="text" placeholder="Test Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"/>
                <textarea placeholder="Test Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" />

                <h4 className="font-bold mt-4">Questions</h4>
                {questions.map((q, qIndex) => (
                    <div key={q.id || qIndex} className="p-3 border rounded dark:border-slate-600 bg-slate-50 dark:bg-slate-900">
                        <div className="flex justify-between items-center mb-2">
                             <label className="font-semibold">Question {qIndex + 1}</label>
                            <button onClick={() => removeQuestion(qIndex)} className="text-red-500"><Trash2Icon className="w-5 h-5"/></button>
                        </div>
                        <textarea value={q.question_text} onChange={e => handleQuestionChange(qIndex, e.target.value)} placeholder={`Question ${qIndex + 1} text`} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 mb-2" />
                        <div className="space-y-2">
                            {(q.options as QuestionOption[]).map((opt, oIndex) => (
                                <div key={oIndex} className="flex items-center gap-2">
                                    <input type="radio" name={`correct_opt_${qIndex}`} checked={opt.isCorrect} onChange={() => handleCorrectOptionChange(qIndex, oIndex)}/>
                                    <input type="text" value={opt.text} onChange={e => handleOptionChange(qIndex, oIndex, e.target.value)} placeholder={`Option ${oIndex + 1}`} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"/>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                 <button onClick={addQuestion} className="text-indigo-600 hover:underline">Add Question</button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
                <button onClick={onClose} className="bg-slate-200 dark:bg-slate-600 px-4 py-2 rounded">Cancel</button>
                <button onClick={handleSubmit} className="bg-indigo-600 text-white px-4 py-2 rounded">Save Test</button>
            </div>
        </Modal>
    );
};


const UserManagement: React.FC<{ users: Profile[], fetchUsers: () => void, loading: boolean }> = ({ users, fetchUsers, loading }) => {
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">User Management</h2>
            {loading ? <Spinner/> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 dark:bg-slate-700">
                            <tr>
                                <th className="p-3">Full Name</th>
                                <th className="p-3">Email</th>
                                <th className="p-3">University ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="border-b dark:border-slate-700">
                                    <td className="p-3">{user.full_name || user.email || 'Unnamed User'}</td>
                                    <td className="p-3">{user.email}</td>
                                    <td className="p-3">{user.university_id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

interface QuestionAnalyticsData {
    questionId: string;
    questionText: string;
    options: QuestionOption[];
    correct: number;
    incorrect: number;
    noAnswer: number;
    optionsCount: number[];
}

const ResultsAnalytics: React.FC<{ tests: Test[], fetchTests: () => void }> = ({ tests, fetchTests }) => {
    const [selectedTestId, setSelectedTestId] = useState('');
    const [results, setResults] = useState<StudentResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [summaryStats, setSummaryStats] = useState<{ participants: number; avgScore: number; highestScore: number; lowestScore: number; } | null>(null);
    const [scoreDistribution, setScoreDistribution] = useState<number[] | null>(null);
    const [questionAnalytics, setQuestionAnalytics] = useState<QuestionAnalyticsData[] | null>(null);
    
    useEffect(() => {
        fetchTests();
    }, [fetchTests]);

    const clearResults = () => {
        setResults([]);
        setSummaryStats(null);
        setScoreDistribution(null);
        setQuestionAnalytics(null);
    };

    const fetchResults = async () => {
        if (!selectedTestId) return;
        setLoading(true);
        clearResults();

        try {
            const { data: questions, error: qError } = await supabase!.from('questions').select('*').eq('test_id', selectedTestId).order('created_at');
            if (qError) throw new Error(`Failed to fetch questions: ${qError.message}`);
            if (!questions || questions.length === 0) { alert('This test has no questions.'); setLoading(false); return; }

            const { data: students, error: sError } = await supabase!.from('profiles').select('*').eq('role', 'student');
            if (sError) throw new Error(`Failed to fetch students: ${sError.message}`);
            if (!students) { alert('No students found.'); setLoading(false); return; }

            const questionIds = questions.map(q => q.id);
            const { data: answers, error: aError } = await supabase!.from('student_answers').select('student_id, question_id, selected_option_index').eq('session_id', 'active_session').in('question_id', questionIds);
            if (aError) throw new Error(`Failed to fetch answers: ${aError.message}`);

            const { data: submissions, error: subError } = await supabase!.from('student_submissions').select('student_id').eq('session_id', 'active_session');
            if (subError) throw new Error(`Failed to fetch submissions: ${subError.message}`);
            
            const participatingStudentIds = new Set(submissions?.map(s => s.student_id));
            if (participatingStudentIds.size === 0) { alert('No students have submitted this test yet.'); setLoading(false); return; }

            const answersByStudent = new Map<string, Map<string, number>>();
            (answers || []).forEach(ans => {
                if (!answersByStudent.has(ans.student_id)) {
                    answersByStudent.set(ans.student_id, new Map());
                }
                answersByStudent.get(ans.student_id)!.set(ans.question_id, ans.selected_option_index);
            });

            const studentScores: number[] = [];
            const studentResultsData: StudentResult[] = [];
            
            students.forEach(student => {
                if (!participatingStudentIds.has(student.id)) return;
                let score = 0;
                const studentAnswers = answersByStudent.get(student.id) || new Map();
                studentAnswers.forEach((selectedIndex, questionId) => {
                    const question = questions.find(q => q.id === questionId);
                    if (question && question.options[selectedIndex]?.isCorrect) {
                        score++;
                    }
                });
                studentScores.push(score);
                studentResultsData.push({ student, answers: [], score, totalQuestions: questions.length });
            });

            setResults(studentResultsData.sort((a, b) => b.score - a.score));
            
            const totalParticipants = participatingStudentIds.size;
            const totalPossibleScore = questions.length;

            if (totalParticipants > 0) {
                const totalScore = studentScores.reduce((sum, s) => sum + s, 0);
                setSummaryStats({
                    participants: totalParticipants,
                    avgScore: (totalScore / totalParticipants / totalPossibleScore) * 100,
                    highestScore: (Math.max(...studentScores) / totalPossibleScore) * 100,
                    lowestScore: (Math.min(...studentScores) / totalPossibleScore) * 100,
                });

                const distribution = Array(10).fill(0).map((_, i) => i);
                const newDistribution = Array(10).fill(0);
                studentScores.forEach(score => {
                    const percentage = (score / totalPossibleScore) * 100;
                    const bucketIndex = percentage === 100 ? 9 : Math.floor(percentage / 10);
                    newDistribution[bucketIndex]++;
                });
                setScoreDistribution(newDistribution);
            }

            const questionAnalyticsData = questions.map(question => {
                const stats: Omit<QuestionAnalyticsData, 'questionId' | 'questionText' | 'options'> = { correct: 0, incorrect: 0, noAnswer: 0, optionsCount: Array(question.options.length).fill(0) };
                students.forEach(student => {
                    if (!participatingStudentIds.has(student.id)) return;
                    const studentAnswers = answersByStudent.get(student.id);
                    if (studentAnswers && studentAnswers.has(question.id)) {
                        const selectedIndex = studentAnswers.get(question.id)!;
                        stats.optionsCount[selectedIndex]++;
                        if (question.options[selectedIndex]?.isCorrect) stats.correct++;
                        else stats.incorrect++;
                    } else {
                        stats.noAnswer++;
                    }
                });
                return { questionId: question.id, questionText: question.question_text, options: question.options, ...stats };
            });
            setQuestionAnalytics(questionAnalyticsData);

        } catch (error) {
            if (error instanceof Error) alert(error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const StatCard: React.FC<{ label: string; value: string; }> = ({ label, value }) => (
        <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    );

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">Results & Analytics</h2>
            <div className="flex gap-4 items-center mb-6">
                 <select value={selectedTestId} onChange={e => { setSelectedTestId(e.target.value); clearResults(); }} className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600">
                    <option value="" disabled>Select a test</option>
                    {tests.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <button onClick={fetchResults} disabled={!selectedTestId || loading} className="bg-indigo-600 text-white px-4 py-2 rounded disabled:bg-indigo-400">
                    {loading ? <Spinner /> : 'Load Results'}
                </button>
            </div>
            
            {loading && <div className="flex justify-center mt-8"><Spinner /></div>}
            
            {!loading && summaryStats && scoreDistribution && questionAnalytics && (
                <div className="mt-6 space-y-8">
                    <div>
                        <h3 className="text-xl font-bold mb-4">Overall Performance</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           <StatCard label="Participants" value={summaryStats.participants.toString()} />
                           <StatCard label="Avg. Score" value={`${summaryStats.avgScore.toFixed(2)}%`} />
                           <StatCard label="Highest Score" value={`${summaryStats.highestScore.toFixed(2)}%`} />
                           <StatCard label="Lowest Score" value={`${summaryStats.lowestScore.toFixed(2)}%`} />
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-bold mb-4">Score Distribution</h3>
                        <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg space-y-2">
                            {scoreDistribution.map((count, index) => (
                                <div key={index} className="flex items-center gap-4">
                                    <span className="text-sm font-mono w-24 text-right">{index * 10}-{(index * 10) + 10}%</span>
                                    <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-6">
                                        <div className="bg-indigo-500 h-6 rounded-full flex items-center justify-start pl-2 text-white text-sm font-bold" style={{ width: `${(count / summaryStats.participants) * 100}%` }}>
                                           {count > 0 ? count : ''}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xl font-bold mb-4">Question Breakdown</h3>
                        <div className="space-y-4">
                            {questionAnalytics.map((q, index) => (
                                <div key={q.questionId} className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
                                    <p className="font-semibold mb-2">{index + 1}. {q.questionText}</p>
                                    <div className="flex gap-4 text-sm mb-3">
                                        <span className="text-green-600 font-semibold">Correct: {q.correct}</span>
                                        <span className="text-red-600 font-semibold">Incorrect: {q.incorrect}</span>
                                        <span className="text-slate-500 font-semibold">No Answer: {q.noAnswer}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {q.options.map((opt, optIndex) => (
                                            <div key={optIndex} className={`p-2 rounded ${opt.isCorrect ? 'border-2 border-green-400' : ''}`}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span>{opt.text}</span>
                                                    <span>{q.optionsCount[optIndex]} response(s)</span>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2.5">
                                                    <div className={`${opt.isCorrect ? 'bg-green-500' : 'bg-slate-400'} h-2.5 rounded-full`} style={{ width: `${q.optionsCount[optIndex] / summaryStats.participants * 100}%` }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-bold mb-4">Student Leaderboard</h3>
                        <div className="overflow-x-auto">
                           <table className="w-full text-left">
                               <thead className="bg-slate-100 dark:bg-slate-700">
                                   <tr>
                                       <th className="p-3">Student Name</th>
                                       <th className="p-3">University ID</th>
                                       <th className="p-3">Score</th>
                                       <th className="p-3">Percentage</th>
                                   </tr>
                               </thead>
                               <tbody>
                                   {results.map(res => (
                                       <tr key={res.student.id} className="border-b dark:border-slate-700">
                                           <td className="p-3">{res.student.full_name}</td>
                                           <td className="p-3">{res.student.university_id}</td>
                                           <td className="p-3">{res.score} / {res.totalQuestions}</td>
                                           <td className="p-3">{((res.score / res.totalQuestions) * 100).toFixed(2)}%</td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                       </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const AuditLogViewer: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            const { data, error } = await supabase!
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            
            if (error) console.error("Error fetching audit logs:", error.message, error);
            else setLogs(data || []);
            setLoading(false);
        };
        fetchLogs();
    }, []);

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg flex justify-center items-center">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">Audit Logs</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                    <thead className="bg-slate-100 dark:bg-slate-700">
                        <tr>
                            <th className="p-3">Timestamp</th>
                            <th className="p-3">User</th>
                            <th className="p-3">Action</th>
                            <th className="p-3">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id} className="border-b dark:border-slate-700">
                                <td className="p-3 text-sm text-slate-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                                <td className="p-3">{log.user_email}</td>
                                <td className="p-3 font-mono text-sm bg-slate-50 dark:bg-slate-900 rounded-md">{log.action}</td>
                                <td className="p-3 text-xs font-mono whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ProfileModal: React.FC<{ isOpen: boolean; onClose: () => void; user: User; profile: Profile; }> = ({ isOpen, onClose, user, profile }) => {
    const [fullName, setFullName] = useState(profile.full_name);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if(isOpen) {
            setFullName(profile.full_name);
            setPassword('');
            setConfirmPassword('');
            setMessage(null);
        }
    }, [isOpen, profile.full_name]);

    const handleSave = async () => {
        setLoading(true);
        setMessage(null);

        if (password && password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' });
            setLoading(false);
            return;
        }
        if (password && password.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
            setLoading(false);
            return;
        }

        try {
            const updatedFields = { updated_name: false, updated_password: false };
            if (fullName !== profile.full_name) {
                const { error: profileError } = await supabase!.from('profiles').update({ full_name: fullName }).eq('id', user.id);
                if (profileError) throw profileError;
                updatedFields.updated_name = true;
            }

            if (password) {
                const { error: authError } = await supabase!.auth.updateUser({ password });
                if (authError) throw authError;
                updatedFields.updated_password = true;
            }

            if (updatedFields.updated_name || updatedFields.updated_password) {
                logAuditEvent('admin_profile_updated', updatedFields);
            }

            alert('Profile updated successfully! Name changes will be visible after a page refresh.');
            onClose();

        } catch (error) {
            if (error instanceof Error) setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };
    
    const inputStyle = "w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit My Profile">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Full Name</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputStyle} />
                </div>
                <hr className="dark:border-slate-600" />
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">New Password (optional)</label>
                    <input type="password" placeholder="Leave blank to keep current password" value={password} onChange={e => setPassword(e.target.value)} className={inputStyle} />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Confirm New Password</label>
                    <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputStyle} />
                </div>
                {message && (
                    <div className={`p-2 rounded text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {message.text}
                    </div>
                )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
                <button onClick={onClose} className="bg-slate-200 dark:bg-slate-600 px-4 py-2 rounded font-semibold hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                <button onClick={handleSave} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded font-semibold hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center w-36">
                    {loading ? <Spinner /> : 'Save Changes'}
                </button>
            </div>
        </Modal>
    );
};

export default AdminDashboard;
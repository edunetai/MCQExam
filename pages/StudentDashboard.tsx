import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile, TestSession, Question } from '../types';
import { Logo, UserIcon, LogoutIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/Icons';
import { Spinner } from '../components/Spinner';
import { Modal } from '../components/Modal';
import { logAuditEvent } from '../services/logging';

const Header: React.FC<{ profile: Profile; onLogout: () => void }> = ({ profile, onLogout }) => (
    <header className="bg-white dark:bg-slate-800 shadow-md p-4 flex justify-between items-center">
        <div className="flex items-center">
            <Logo className="w-8 h-8 text-indigo-600" />
            <h1 className="ml-3 text-xl font-bold text-slate-800 dark:text-slate-200">Student Dashboard</h1>
        </div>
        <div className="flex items-center space-x-4">
            <div className="flex items-center">
                <UserIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                <span className="ml-2 text-slate-700 dark:text-slate-300">{profile.full_name || profile.email}</span>
            </div>
            <button onClick={onLogout} className="flex items-center text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                <LogoutIcon className="w-6 h-6" />
                <span className="ml-1">Logout</span>
            </button>
        </div>
    </header>
);

const Timer: React.FC<{ session: TestSession; onTimeUp: () => void }> = ({ session, onTimeUp }) => {
    const [timeLeft, setTimeLeft] = useState(() => session.duration_minutes * 60);

    useEffect(() => {
        let interval: number | undefined;

        if (session.status === 'started' && session.start_time) {
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
                const newTimeLeft = calculateTimeLeft();
                if (newTimeLeft <= 0) {
                    setTimeLeft(0);
                    onTimeUp();
                    clearInterval(interval);
                } else {
                    setTimeLeft(newTimeLeft);
                }
            }, 1000);
        } else if (session.status !== 'started' && session.start_time) {
            // For 'paused' or 'finished' states, calculate and display static time left.
            const start = new Date(session.start_time).getTime();
            // Use last_paused_at if available, otherwise use current time (for finished state)
            const end = session.last_paused_at ? new Date(session.last_paused_at).getTime() : new Date().getTime();
            const grossElapsedSeconds = Math.floor((end - start) / 1000);
            const netElapsedSeconds = grossElapsedSeconds - (session.total_paused_duration_seconds || 0);
            const totalSeconds = session.duration_minutes * 60;
            setTimeLeft(Math.max(0, totalSeconds - netElapsedSeconds));
        } else {
            // For 'waiting' state
            setTimeLeft(session.duration_minutes * 60);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [session, onTimeUp]);


    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    return (
        <div className="text-center my-4">
            <span className="text-4xl font-mono tracking-widest text-slate-800 dark:text-slate-200">{formatTime(timeLeft)}</span>
            <p className="text-sm text-slate-500 dark:text-slate-400">Time Remaining</p>
        </div>
    );
};

const ReportSummary: React.FC<{
    questions: Question[];
    answers: Map<string, number>;
}> = ({ questions, answers }) => {
    const totalQuestions = questions.length;
    const answeredQuestions = answers.size;
    
    let correctAnswers = 0;
    answers.forEach((selectedIndex, questionId) => {
        const question = questions.find(q => q.id === questionId);
        if (question && question.options[selectedIndex]?.isCorrect) {
            correctAnswers++;
        }
    });

    const scorePercentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    return (
        <div className="p-6 max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-lg shadow-lg text-center my-8">
            <h2 className="text-3xl font-bold mb-4">Final Report</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-6">Your test has been submitted. Here is a summary of your performance.</p>
            
            <div className="grid grid-cols-2 gap-4 text-left mb-8">
                <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-md">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Questions</p>
                    <p className="text-2xl font-bold">{totalQuestions}</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-md">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Answered</p>
                    <p className="text-2xl font-bold">{answeredQuestions}</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-md">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Correct Answers</p>
                    <p className="text-2xl font-bold text-green-500">{correctAnswers}</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-md">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Incorrect/Unanswered</p>
                    <p className="text-2xl font-bold text-red-500">{totalQuestions - correctAnswers}</p>
                </div>
            </div>
            
            <div className="mb-6">
                <p className="text-slate-500 dark:text-slate-400">Final Score</p>
                <p className="text-5xl font-bold text-indigo-600 dark:text-indigo-400">{scorePercentage.toFixed(2)}%</p>
            </div>

            <p className="text-slate-500 dark:text-slate-400">Please wait for the administrator to start the next session.</p>
        </div>
    );
};

const QuestionStatusGrid: React.FC<{
    questions: Question[];
    answers: Map<string, number>;
    currentQuestionIndex: number;
    onJumpTo: (index: number) => void;
}> = ({ questions, answers, currentQuestionIndex, onJumpTo }) => {
    return (
        <div className="mb-8 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-300">Question Navigator</h3>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {questions.map((q, index) => {
                    const isAnswered = answers.has(q.id);
                    const isCurrent = index === currentQuestionIndex;
                    
                    let baseStyle = "w-full h-10 flex items-center justify-center rounded-md font-bold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900";
                    let statusStyle = "";

                    if (isCurrent) {
                        statusStyle = "ring-2 ring-indigo-500 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300";
                    } else if (isAnswered) {
                        statusStyle = "bg-green-500 text-white hover:bg-green-600";
                    } else {
                        statusStyle = "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600";
                    }
                    
                    return (
                        <button 
                            key={q.id} 
                            onClick={() => onJumpTo(index)}
                            className={`${baseStyle} ${statusStyle}`}
                            aria-label={`Go to question ${index + 1}`}
                        >
                            {index + 1}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const TestArea: React.FC<{
    session: TestSession;
    questions: Question[];
    answers: Map<string, number>;
    currentQuestionIndex: number;
    onSelectOption: (questionId: string, optionIndex: number) => void;
    onFinalSubmit: () => void;
    isSubmitting: boolean;
    onNavigate: (direction: 'next' | 'prev') => void;
    onJumpToQuestion: (index: number) => void;
}> = ({ session, questions, answers, currentQuestionIndex, onSelectOption, onFinalSubmit, isSubmitting, onNavigate, onJumpToQuestion }) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return null;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <QuestionStatusGrid
                questions={questions}
                answers={answers}
                currentQuestionIndex={currentQuestionIndex}
                onJumpTo={onJumpToQuestion}
            />
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">{session.test_title}</h2>
                <span className="text-sm font-semibold bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                    Question {currentQuestionIndex + 1} of {questions.length}
                </span>
            </div>

            <div key={currentQuestion.id} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow min-h-[300px]">
                <p className="font-semibold mb-4 text-lg">{currentQuestion.question_text}</p>
                <div className="space-y-3">
                    {currentQuestion.options.map((option, oIndex) => (
                        <label key={oIndex} className="flex items-center p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-slate-900 has-[:checked]:border-indigo-300 dark:has-[:checked]:border-indigo-700">
                            <input
                                type="radio"
                                name={`question-${currentQuestion.id}`}
                                checked={answers.get(currentQuestion.id) === oIndex}
                                onChange={() => onSelectOption(currentQuestion.id, oIndex)}
                                className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span>{option.text}</span>
                        </label>
                    ))}
                </div>
            </div>
            
            <div className="mt-8 flex justify-between items-center">
                <button
                    onClick={() => onNavigate('prev')}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-2 bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold py-2 px-6 rounded-md hover:bg-slate-400 dark:hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeftIcon className="w-5 h-5" />
                    Previous
                </button>
                
                {currentQuestionIndex === questions.length - 1 && (
                     <button
                        onClick={onFinalSubmit}
                        disabled={isSubmitting}
                        className="bg-green-600 text-white font-bold py-2 px-6 rounded-md hover:bg-green-700 transition duration-300 disabled:bg-green-400 disabled:cursor-not-allowed flex justify-center items-center w-40"
                    >
                        {isSubmitting ? <Spinner /> : 'Submit Test'}
                    </button>
                )}

                {currentQuestionIndex < questions.length - 1 && (
                     <button
                        onClick={() => onNavigate('next')}
                        className="flex items-center gap-2 bg-indigo-600 text-white font-bold py-2 px-6 rounded-md hover:bg-indigo-700"
                    >
                        Next
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

const ProfileManagement: React.FC<{ user: User; profile: Profile; }> = ({ user, profile }) => {
    const [fullName, setFullName] = useState(profile.full_name);
    const [universityId, setUniversityId] = useState(profile.university_id);
    const [infoLoading, setInfoLoading] = useState(false);
    const [infoMessage, setInfoMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [email, setEmail] = useState(profile.email);
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const formCardStyle = "bg-white dark:bg-slate-800 p-6 rounded-lg shadow";
    const inputStyle = "w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500";
    const buttonStyle = "bg-indigo-600 text-white px-4 py-2 rounded font-semibold hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center min-w-[120px]";

    const handleInfoUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setInfoLoading(true);
        setInfoMessage(null);
        
        const { error } = await supabase!.from('profiles').update({
            full_name: fullName,
            university_id: universityId
        }).eq('id', user.id);

        if (error) {
            setInfoMessage({ type: 'error', text: error.message });
        } else {
            setInfoMessage({ type: 'success', text: 'Information updated successfully! Name changes will be visible after a page refresh.' });
            logAuditEvent('student_profile_info_updated', { fullName, universityId });
        }
        setInfoLoading(false);
    };
    
    const handleEmailUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailLoading(true);
        setEmailMessage(null);

        const { error } = await supabase!.auth.updateUser({ email });
        
        if (error) {
            setEmailMessage({ type: 'error', text: error.message });
        } else {
            setEmailMessage({ type: 'success', text: 'A confirmation link has been sent to your new email address. Please verify to complete the change.' });
            logAuditEvent('student_profile_email_update_request', { newEmail: email });
        }
        setEmailLoading(false);
    };

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordLoading(true);
        setPasswordMessage(null);
        if (password !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
            setPasswordLoading(false);
            return;
        }
        if (password.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
            setPasswordLoading(false);
            return;
        }

        const { error } = await supabase!.auth.updateUser({ password });
        if (error) {
            setPasswordMessage({ type: 'error', text: error.message });
        } else {
            setPasswordMessage({ type: 'success', text: 'Password updated successfully.' });
            logAuditEvent('student_profile_password_updated');
            setPassword('');
            setConfirmPassword('');
        }
        setPasswordLoading(false);
    };

    const Message: React.FC<{ message: { type: 'success' | 'error', text: string } | null }> = ({ message }) => {
        if (!message) return null;
        return (
            <div className={`p-2 mt-2 rounded text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.text}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <form onSubmit={handleInfoUpdate} className={formCardStyle}>
                <h3 className="text-xl font-bold mb-4">Personal Information</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Full Name</label>
                        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">University ID</label>
                        <input type="text" value={universityId} onChange={e => setUniversityId(e.target.value)} className={inputStyle} />
                    </div>
                    <Message message={infoMessage} />
                </div>
                <div className="mt-4 flex justify-end">
                    <button type="submit" disabled={infoLoading} className={buttonStyle}>{infoLoading ? <Spinner/> : 'Save Info'}</button>
                </div>
            </form>

            <form onSubmit={handleEmailUpdate} className={formCardStyle}>
                <h3 className="text-xl font-bold mb-4">Change Email</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Email Address</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputStyle} />
                    </div>
                     <Message message={emailMessage} />
                </div>
                <div className="mt-4 flex justify-end">
                    <button type="submit" disabled={emailLoading} className={buttonStyle}>{emailLoading ? <Spinner/> : 'Update Email'}</button>
                </div>
            </form>

            <form onSubmit={handlePasswordUpdate} className={formCardStyle}>
                <h3 className="text-xl font-bold mb-4">Change Password</h3>
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">New Password</label>
                        <input type="password" placeholder="Enter new password" value={password} onChange={e => setPassword(e.target.value)} className={inputStyle} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Confirm New Password</label>
                        <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputStyle} />
                    </div>
                    <Message message={passwordMessage} />
                </div>
                <div className="mt-4 flex justify-end">
                    <button type="submit" disabled={passwordLoading} className={buttonStyle}>{passwordLoading ? <Spinner/> : 'Update Password'}</button>
                </div>
            </form>
        </div>
    );
};

const StudentDashboard: React.FC<{ user: User; profile: Profile }> = ({ user, profile }) => {
    const [session, setSession] = useState<TestSession | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('status');
    
    const [loadingTest, setLoadingTest] = useState(true);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Map<string, number>>(new Map());
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const hasLoggedTestStart = useRef(false);

    const handleLogout = async () => {
        await logAuditEvent('student_logout');
        await supabase!.auth.signOut();
    };

    const fetchTestSession = useCallback(async () => {
        setError(null);
        try {
            const { data, error } = await supabase!.from('test_sessions').select('*').eq('id', 'active_session').single();
            if (error && error.code !== 'PGRST116') throw error;
            setSession(data || { id: 'active_session', test_id: null, status: 'waiting', duration_minutes: 60, start_time: null, test_title: '', last_paused_at: null, total_paused_duration_seconds: 0 });
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('Error fetching test session:', errorMessage, err);
            setError(`Connection issue detected: ${errorMessage || 'An unknown error occurred'}. Displaying last known status.`);
            setSession(prevSession => prevSession || { id: 'active_session', test_id: null, status: 'waiting', duration_minutes: 60, start_time: null, test_title: '', last_paused_at: null, total_paused_duration_seconds: 0 });
        }
    }, []);

    const fetchTestContent = useCallback(async () => {
        if (!session?.test_id) return;
        setLoadingTest(true);

        const { data: questionsData, error: questionsError } = await supabase!.from('questions').select('*').eq('test_id', session.test_id).order('created_at', { ascending: true });
        if (questionsError) {
            console.error('Error fetching questions:', questionsError.message, questionsError);
            if (questionsError.message.includes("does not exist")) {
                 setError("Database error: The 'questions' table is missing. Please inform the administrator.");
            }
        } else {
            setQuestions(questionsData || []);
        }

        const { data: answersData, error: answersError } = await supabase!.from('student_answers').select('question_id, selected_option_index').eq('student_id', user.id).eq('session_id', 'active_session');
        if (answersError) {
            console.error('Error fetching answers:', answersError.message, answersError);
            if (answersError.message.includes("does not exist")) {
                setError("Database error: The 'student_answers' table is missing. Please inform the administrator.");
            }
        }
        else if (answersData) {
            const newAnswers = new Map<string, number>();
            answersData.forEach(ans => newAnswers.set(ans.question_id, ans.selected_option_index));
            setAnswers(newAnswers);
        }
        setLoadingTest(false);
    }, [session?.test_id, user.id]);

    useEffect(() => {
        fetchTestSession();
        const channel = supabase!.channel('test-session-student')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'test_sessions', filter: 'id=eq.active_session' },
                payload => {
                    setError(null);
                    const newSession = payload.new as TestSession;
                    if (newSession.status === 'waiting' && session?.status !== 'waiting') {
                        // This block resets the student's state when the admin resets the test.
                        setIsSubmitted(false);
                        setIsSubmitting(false); // Fix: Reset submitting state for the next test.
                        setQuestions([]);
                        setAnswers(new Map());
                        setCurrentQuestionIndex(0);
                        hasLoggedTestStart.current = false;
                    }
                    setSession(newSession);
                }
            )
            .subscribe();
        return () => { supabase!.removeChannel(channel) };
    }, [fetchTestSession, session?.status]);

    useEffect(() => {
        const checkSubmissionStatus = async () => {
            if (!session?.test_id) {
                setCheckingStatus(false);
                return;
            };
            setCheckingStatus(true);
            const { data, error: dbError } = await supabase!
                .from('student_submissions')
                .select('student_id')
                .eq('session_id', 'active_session')
                .eq('student_id', user.id)
                .maybeSingle();

            if (dbError) {
                if (dbError.message.includes("does not exist")) {
                    setError("Database error: The 'student_submissions' table is missing. Please inform the administrator.");
                } else {
                    console.error('Error checking submission status:', dbError.message);
                }
            } else if (data) {
                setIsSubmitted(true);
            }
            setCheckingStatus(false);
        };

        if (session) {
            checkSubmissionStatus();
        }
    }, [session, user.id]);

    useEffect(() => {
        if ((session?.status === 'started' || session?.status === 'finished') && session.test_id && questions.length === 0) {
            fetchTestContent();
        }
    }, [session?.status, session?.test_id, questions.length, fetchTestContent]);

    const handleSelectOption = async (questionId: string, optionIndex: number) => {
        const newAnswers = new Map(answers);
        newAnswers.set(questionId, optionIndex);
        setAnswers(newAnswers);

        const { error } = await supabase!.from('student_answers').upsert({
            session_id: 'active_session',
            student_id: user.id,
            question_id: questionId,
            selected_option_index: optionIndex,
        }, { onConflict: 'session_id,student_id,question_id' });
        if (error) console.error('Error saving answer:', error.message, error);
    };

    const handleNavigate = (direction: 'next' | 'prev') => {
        if (direction === 'next' && currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else if (direction === 'prev' && currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleJumpToQuestion = (index: number) => {
        if (index >= 0 && index < questions.length) {
            setCurrentQuestionIndex(index);
        }
    };

    const handleFinalSubmit = useCallback(async (isAutoSubmit = false) => {
        console.log('--- Submit Test Logic Initiated ---');
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log('Submission type:', isAutoSubmit ? 'Automatic (Time Up)' : 'Manual');
    
        console.log('Setting submission state to `isSubmitting = true`.');
        setIsSubmitting(true);
        
        const submissionPayload = {
            session_id: 'active_session',
            student_id: user.id,
        };
        console.log('Attempting to insert into `student_submissions` with payload:', submissionPayload);
        
        const { error } = await supabase!.from('student_submissions').insert(submissionPayload);
    
        if (error) {
            console.error('Database submission FAILED. Error object:', error);
            alert(`There was an error submitting your test: ${error.message}`);
            console.log('Resetting submission state to `isSubmitting = false` due to error.');
            setIsSubmitting(false); // Re-enable on error
            console.log('--- Submit Test Logic Aborted due to Error ---');
            return;
        }
    
        console.log('Database submission SUCCEEDED.');
        logAuditEvent(isAutoSubmit ? 'student_auto_submitted' : 'student_submitted_test', { testId: session?.test_id });
        
        console.log('Setting final submitted state to `isSubmitted = true`. UI should now show the report.');
        setIsSubmitted(true);
        
        if (isAutoSubmit) {
            console.log('Displaying auto-submission alert.');
            alert("Time is up! Your test has been submitted automatically. Please review your report.");
        }
        
        console.log('--- Submit Test Logic Completed Successfully ---');
    }, [session?.test_id, user.id]);

    const handleManualSubmit = useCallback(() => {
        console.log('Opening submission confirmation modal.');
        setIsConfirmModalOpen(true);
    }, []);
    
    const ErrorBanner: React.FC<{ message: string | null }> = ({ message }) => message ? (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 text-center" role="alert">
            <p className="font-bold">Application Error</p>
            <p>{message}</p>
        </div>
    ) : null;

    const renderContent = () => {
        if (!session || checkingStatus) return <div className="flex justify-center items-center h-full"><Spinner /></div>;
        
        if (session.status === 'started') {
            if (isSubmitted) {
                return <ReportSummary questions={questions} answers={answers} />;
            }
            if (loadingTest) return <div className="flex justify-center items-center h-full"><Spinner /></div>;
            
            if (!hasLoggedTestStart.current) {
                logAuditEvent('student_started_test', { testId: session.test_id, testTitle: session.test_title });
                hasLoggedTestStart.current = true;
            }

            return <>
                <Timer session={session} onTimeUp={() => handleFinalSubmit(true)} />
                <TestArea 
                    session={session} 
                    questions={questions} 
                    answers={answers} 
                    currentQuestionIndex={currentQuestionIndex}
                    onSelectOption={handleSelectOption} 
                    onFinalSubmit={handleManualSubmit} 
                    isSubmitting={isSubmitting}
                    onNavigate={handleNavigate}
                    onJumpToQuestion={handleJumpToQuestion}
                />
            </>;
        }

        if (session.status === 'paused') {
            return (
                <div className="text-center p-8 flex flex-col items-center justify-center">
                    <Timer session={session} onTimeUp={() => {}} />
                    <h2 className="text-2xl font-bold">The test has been paused.</h2>
                    <p>Please wait for the administrator to resume the session.</p>
                </div>
            );
        }

        if (session.status === 'finished' || isSubmitted) {
            return <ReportSummary questions={questions} answers={answers} />;
        }

        // Default: Waiting view
        const TabButton = ({ tabName, label }: { tabName: string; label: string }) => (
            <button onClick={() => setActiveTab(tabName)} className={`px-4 py-2 font-semibold rounded-md ${activeTab === tabName ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                {label}
            </button>
        );
        
        return (
            <div className="p-4 md:p-6 max-w-4xl mx-auto">
                <div className="mb-6 flex justify-center space-x-2 border-b border-slate-300 dark:border-slate-700 pb-2">
                    <TabButton tabName="status" label="Test Status" />
                    <TabButton tabName="profile" label="My Profile" />
                </div>
                {activeTab === 'status' && (
                    <div className="text-center p-8 flex flex-col items-center justify-center">
                        <Spinner />
                        <h2 className="text-2xl font-bold mt-4">Waiting for the test to start...</h2>
                        <p className="text-slate-500 dark:text-slate-400">Please wait for the administrator to begin the session.</p>
                    </div>
                )}
                {activeTab === 'profile' && <ProfileManagement user={user} profile={profile} />}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <Header profile={profile} onLogout={handleLogout} />
            <ErrorBanner message={error} />
            <main className="flex-1 overflow-y-auto">
                {renderContent()}
            </main>
            <Modal
                isOpen={isConfirmModalOpen}
                onClose={() => {
                    console.log('User cancelled submission via modal close button.');
                    setIsConfirmModalOpen(false);
                }}
                title="Confirm Test Submission"
            >
                <div>
                    <p className="text-slate-600 dark:text-slate-300">
                        Are you sure you want to finalize and submit your test? You will not be able to change your answers after this point.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button 
                            onClick={() => {
                                console.log('User clicked Cancel in modal.');
                                console.log('--- Submit Test Logic Aborted ---');
                                setIsConfirmModalOpen(false);
                            }} 
                            className="bg-slate-200 dark:bg-slate-600 px-4 py-2 rounded font-semibold hover:bg-slate-300 dark:hover:bg-slate-500"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                console.log('User confirmed submission via modal.');
                                setIsConfirmModalOpen(false);
                                handleFinalSubmit(false);
                            }}
                            className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-700"
                        >
                            Yes, Submit Test
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default StudentDashboard;
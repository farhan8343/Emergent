import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { ArrowRight, Check, MessageSquare, Pin, Users, Zap } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const features = [
    {
      icon: <Pin className="w-6 h-6" />,
      title: 'Pin-Based Markup',
      description: 'Click anywhere on websites, PDFs, or images to leave precise feedback'
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: 'Threaded Comments',
      description: 'Organized conversations with file attachments and reply notifications'
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Team Collaboration',
      description: 'Invite team members and collect guest feedback without registration'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Multi-Format Support',
      description: 'Review live websites, PDFs, and images all in one place'
    }
  ];

  const plans = [
    {
      name: 'Starter',
      price: '$29',
      period: '/month',
      members: '5 team members',
      storage: '1 GB storage',
      features: ['Unlimited projects', 'Guest comments', 'Email notifications']
    },
    {
      name: 'Pro',
      price: '$79',
      period: '/month',
      members: '10 team members',
      storage: '5 GB storage',
      features: ['Everything in Starter', 'Priority support', 'Advanced analytics'],
      popular: true
    },
    {
      name: 'Business',
      price: '$199',
      period: '/month',
      members: '50 team members',
      storage: '20 GB storage',
      features: ['Everything in Pro', 'Custom branding', 'SSO integration']
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-border/40 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Markuply
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/auth')}
                data-testid="landing-login-btn"
              >
                Login
              </Button>
              <Button
                onClick={() => navigate('/auth')}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6 transition-transform hover:scale-105 active:scale-95"
                data-testid="landing-get-started-btn"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 hero-gradient pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="hero-heading">
              Visual Feedback,
              <span className="text-accent"> Simplified</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
              Pin comments directly on websites, PDFs, and images. Perfect for design reviews, QA testing, and client feedback.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => navigate('/auth')}
                className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-8 py-6 text-lg font-medium transition-transform hover:scale-105 active:scale-95"
                data-testid="hero-start-btn"
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                className="rounded-full px-8 py-6 text-lg"
                data-testid="hero-demo-btn"
              >
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Everything you need for visual review
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Streamline your feedback process with powerful, intuitive tools
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                data-testid={`feature-card-${index}`}
              >
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center text-accent mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Choose the plan that fits your team
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`bg-white rounded-2xl p-8 border-2 transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular ? 'border-accent shadow-xl' : 'border-border/40 shadow-sm hover:shadow-md'
                }`}
                data-testid={`pricing-card-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="bg-accent text-white text-sm font-medium px-3 py-1 rounded-full inline-block mb-4">
                    Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {plan.name}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm font-medium mb-2">{plan.members}</p>
                <p className="text-sm text-muted-foreground mb-6">{plan.storage}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start">
                      <Check className="w-5 h-5 text-accent mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => navigate('/auth')}
                  className={`w-full rounded-full py-6 transition-transform hover:scale-105 active:scale-95 ${
                    plan.popular
                      ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                  data-testid={`pricing-btn-${plan.name.toLowerCase()}`}
                >
                  Get Started
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Ready to streamline your feedback?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Join teams using Markuply to deliver pixel-perfect projects faster
          </p>
          <Button
            onClick={() => navigate('/auth')}
            className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-8 py-6 text-lg font-medium transition-transform hover:scale-105 active:scale-95"
            data-testid="cta-start-btn"
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center text-muted-foreground">
          <p>&copy; 2025 Markuply. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
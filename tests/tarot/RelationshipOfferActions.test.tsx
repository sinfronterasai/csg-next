import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RelationshipOfferActions from '@/components/tarot/RelationshipOfferActions';
jest.mock('@/lib/campaign/client', () => ({ campaignEvent: jest.fn() }));
function response(status:string) { return {ok:true,json:async()=>({status})}; }
it('starts account creation with the selected offer as return destination', async () => {
  global.fetch = jest.fn().mockResolvedValue(response('signed_out'));
  render(<RelationshipOfferActions />);
  expect(await screen.findByRole('link',{name:/create account/i})).toHaveAttribute('href','/signup?returnTo=%2Ftarot%2Frelationship-dynamics%23purchase');
});
it('rechecks confirmed entitlement before showing the reading link', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(response('locked')).mockResolvedValueOnce(response('unlocked'));
  render(<RelationshipOfferActions />);
  const checkout = await screen.findByRole('link',{name:/secure checkout/i});
  expect(checkout).toHaveAttribute('href','https://whop.com/checkout/plan_FojHN8WK5oMKA');
  expect(screen.queryByRole('link',{name:'Ask my relationship question'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/check my access/i}));
  expect(await screen.findByRole('link',{name:'Ask my relationship question'})).toHaveAttribute('href','/tarot?spread=relationship_dynamics');
});
it('does not show a checkout link on a failed access check', async () => {
  global.fetch = jest.fn().mockResolvedValue({ok:false,json:async()=>({error:'Unavailable'})});
  render(<RelationshipOfferActions />);
  await waitFor(()=>expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(screen.queryByRole('link',{name:/secure checkout/i})).not.toBeInTheDocument();
});

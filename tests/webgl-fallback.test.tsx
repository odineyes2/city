// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {render,fireEvent,screen,cleanup} from '@testing-library/react';
import CityView from '../src/game/city/CityView';
import {newGame} from '../src/engine';
import {presentGame} from '../src/game/presentation/GamePresentation';
vi.mock('../src/game/city/WebGLSupport',()=>({supportsWebGL:()=>false}));
it('WebGL 미지원이어도 관리 화면으로 이동할 수 있다',()=>{const game=newGame(727,1000),onView=vi.fn();render(<CityView game={game} act={vi.fn()} selected={0} onSelect={vi.fn()} onView={onView} presentation={presentGame(game)}/>);expect(screen.getByRole('alert').textContent).toContain('3D 화면을 사용할 수 없습니다');fireEvent.click(screen.getByRole('button',{name:'관리 화면에서 계속'}));expect(onView).toHaveBeenCalledWith('management');expect(document.querySelector('canvas')).toBeNull();cleanup();});

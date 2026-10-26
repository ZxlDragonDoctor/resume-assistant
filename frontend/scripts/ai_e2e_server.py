"""Loopback-only synthetic resume API plus the real AI routes in local-rule mode.

Run with Python >=3.10 and ai-service's development dependencies. This harness
never contacts a configured model or touches production data.
"""
import copy
import json
import os
import pathlib
import sys
import uuid
from datetime import datetime, timedelta

os.environ['OPENAI_API_KEY'] = ''
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'ai-service'))

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.main import app as ai_app

root = pathlib.Path(__file__).resolve().parents[2]
catalog = json.loads((root / 'templates/catalog/product-manager.json').read_text(encoding='utf-8'))
resume_id = '11111111-1111-4111-8111-111111111111'

def initial():
    sections = []
    for item in catalog['sample']['sections']:
        if item['sectionType'] == 'summary':
            continue
        section = copy.deepcopy(item)
        section.update(id=str(uuid.uuid4()), isVisible=True)
        if section['sectionType'] == 'experience':
            section['data']['items'][0]['bullets'][0] = '参与了客户访谈，整理 20 份反馈'
        sections.append(section)
    return dict(id=resume_id, title='AI功能闭环测试', targetJob='', templateId=None,
                fontFamily='system-ui', fontSize=13, themeColor='#2563eb', lineSpacing=1.55,
                layoutConfig=json.dumps(catalog['config']), shareEnabled=False, viewCount=0,
                status='draft', createdAt='2026-10-21T08:00:00', updatedAt='2026-10-21T08:00:00', sections=sections)

def history_fixture(resume):
    snapshot = copy.deepcopy(resume)
    snapshot['title'] = '历史完整简历'
    snapshot['sections'][0]['data']['name'] = '历史候选人'
    snapshot['sections'].append(dict(id=str(uuid.uuid4()), sectionType='custom', sortOrder=99,
        isVisible=True, data={'_config': {'moduleName': '历史项目复盘'},
        'content': ''.join(f'<p>历史项目第 {i} 项：协调产品设计与研发团队完成需求评审、验证与交付。</p>' for i in range(1, 55)) + '<p>历史末页完整内容标记</p>'}))
    return [dict(id='history-initial', versionNum=1, label='最初定稿', description='用于完整分页历史预览验收',
                 createdAt='2026-10-20T08:00:00', snapshot=snapshot)]

def reset_state():
    resume = initial()
    return dict(resume=resume, versions=history_fixture(resume), failSave=0, failAi={}, delayAi={}, calls=[], writes=[])

state = reset_state()
app = FastAPI()

def ok(data=None):
    return {'code': 200, 'message': 'success', 'data': data}

@app.get('/__e2e/state')
async def inspect():
    return state

@app.post('/__e2e/control')
async def control(request: Request):
    value = await request.json()
    if value.pop('reset', False):
        state.clear()
        state.update(reset_state())
    for key in ['failSave', 'failAi', 'delayAi']:
        if key in value:
            state[key] = value[key]
    return ok()

@app.get('/api/auth/me')
async def me():
    return ok({'id': 'e2e-user', 'name': 'AI测试', 'email': 'ai-e2e@example.com'})

@app.post('/api/auth/login')
async def login():
    return ok({'token': 'local-e2e-token', 'userId': 'e2e-user', 'name': 'AI测试', 'email': 'ai-e2e@example.com'})

@app.get('/api/resumes')
async def resumes():
    return ok([state['resume']])

@app.get('/api/resumes/stats')
async def stats():
    return ok({'totalResumes': 1, 'draftResumes': 1, 'completedResumes': 0, 'sharedResumes': 0, 'totalViews': 0})

@app.get('/api/resumes/{resume_id}/versions')
async def versions(resume_id: str):
    return ok([{key: value for key, value in version.items() if key != 'snapshot'} for version in reversed(state['versions'])])

@app.get('/api/resumes/{resume_id}/versions/{version_id}')
async def version_detail(resume_id: str, version_id: str):
    state['calls'].append({'path': f'versions/{version_id}', 'method': 'GET'})
    version = next((v for v in state['versions'] if v['id'] == version_id), None)
    if not version:
        return JSONResponse(status_code=404, content={'code': 404, 'message': '版本不存在', 'data': None})
    return ok(copy.deepcopy(version))

@app.put('/api/resumes/{resume_id}/content')
async def save_content(resume_id: str, request: Request):
    body = await request.json()
    if state['failSave']:
        state['failSave'] -= 1
        return JSONResponse(status_code=503, content={'code': 503, 'message': '测试保存失败', 'data': None})
    if body.get('expectedUpdatedAt') != state['resume']['updatedAt']:
        return JSONResponse(status_code=409, content={'code': 409, 'message': '简历已更新，请刷新后重试', 'data': None})
    for key in ['title', 'targetJob', 'targetCompany', 'templateId', 'fontFamily', 'fontSize', 'themeColor', 'lineSpacing', 'layoutConfig', 'sections']:
        if key in body:
            state['resume'][key] = copy.deepcopy(body[key])
    previous = datetime.fromisoformat(state['resume']['updatedAt'])
    state['resume']['updatedAt'] = (previous + timedelta(seconds=1)).isoformat()
    number = max(v['versionNum'] for v in state['versions']) + 1
    state['versions'].append(dict(id=str(uuid.uuid4()), versionNum=number,
        label=body.get('label') or f'保存版本 {number}', description=body.get('description'),
        createdAt=state['resume']['updatedAt'], snapshot=copy.deepcopy(state['resume'])))
    state['writes'].append({'operation': 'saveContent', 'body': copy.deepcopy(body)})
    return ok(copy.deepcopy(state['resume']))

@app.delete('/api/resumes/{resume_id}/versions/{version_id}')
async def delete_version(resume_id: str, version_id: str):
    state['versions'] = [v for v in state['versions'] if v['id'] != version_id]
    state['writes'].append({'operation': 'deleteVersion', 'id': version_id})
    return ok()

@app.get('/api/resumes/{resume_id}')
async def detail(resume_id: str):
    return ok(state['resume'])

@app.put('/api/resumes/{resume_id}')
async def update_resume(resume_id: str, request: Request):
    state['resume'].update(await request.json())
    return ok()

@app.post('/api/resumes/{resume_id}/sections')
async def add_section(resume_id: str, request: Request):
    body = await request.json()
    body.update(id=str(uuid.uuid4()), isVisible=True)
    body['data'] = json.loads(body['data']) if isinstance(body.get('data'), str) else body.get('data', {})
    state['resume']['sections'].append(body)
    state['writes'].append({'operation': 'create', 'id': body['id']})
    return ok(body)

@app.put('/api/resumes/sections/{section_id}')
async def update_section(section_id: str, request: Request):
    if state['failSave']:
        state['failSave'] -= 1
        return JSONResponse(status_code=503, content={'code': 503, 'message': '测试保存失败', 'data': None})
    body = await request.json()
    for section in state['resume']['sections']:
        if section['id'] == section_id:
            section.update(body)
            section['data'] = json.loads(body['data']) if isinstance(body.get('data'), str) else body.get('data', {})
            state['writes'].append({'operation': 'update', 'id': section_id})
            return ok()
    return JSONResponse(status_code=404, content={'code': 404, 'message': '模块不存在', 'data': None})

@app.get('/api/templates')
async def templates():
    return ok([])

@app.api_route('/api/ai/{path:path}', methods=['GET', 'POST'])
async def ai(path: str, request: Request):
    import asyncio
    body = await request.body()
    state['calls'].append({'path': path, 'body': json.loads(body) if body else None})
    delay = state['delayAi'].get(path, 0)
    if delay:
        state['delayAi'][path] = 0
        await asyncio.sleep(delay)
    if state['failAi'].get(path, 0):
        state['failAi'][path] -= 1
        return JSONResponse(status_code=503, content={'code': 503, 'message': '测试AI暂不可用', 'data': None})
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=ai_app), base_url='http://ai-test') as client:
        response = await client.request(request.method, f'/api/ai/{path}', content=body, headers={'Content-Type': 'application/json'})
    return JSONResponse(status_code=response.status_code, content=response.json())

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=int(os.getenv('AI_E2E_PORT', '8080')), log_level='warning')
